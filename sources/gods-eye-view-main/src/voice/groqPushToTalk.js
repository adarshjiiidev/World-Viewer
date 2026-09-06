const MAX_RECORDING_MS = 45_000;

/**
 * Groq's browser-safe voice path: local microphone capture -> our same-origin
 * transcription broker -> Groq chat -> optional Groq speech playback. It is
 * deliberately distinct from the OpenAI WebRTC Realtime control.
 */
export function initGroqPushToTalk({ ui }) {
  const button = ui?.groqPttButton;
  if (!button || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return null;

  let stream = null;
  let recorder = null;
  let chunks = [];
  let timer = null;
  let busy = false;

  const setState = (label, detail) => {
    button.textContent = label;
    button.disabled = busy;
    if (ui?.detail) {
      ui.detail.textContent = detail;
      ui.detail.title = detail;
    }
  };

  const releaseStream = () => {
    stream?.getTracks?.().forEach((track) => track.stop());
    stream = null;
  };

  const speak = async (text) => {
    const response = await fetch('/api/groq/speech', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text }),
    });
    if (!response.ok) return;
    const url = URL.createObjectURL(await response.blob());
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play().catch(() => URL.revokeObjectURL(url));
  };

  const finish = async () => {
    if (!recorder || recorder.state === 'inactive') return;
    recorder.stop();
  };

  const start = async (event) => {
    event?.preventDefault?.();
    if (busy || recorder?.state === 'recording') return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
      chunks = [];
      recorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported('audio/webm') ? { mimeType: 'audio/webm' } : undefined);
      recorder.ondataavailable = (item) => { if (item.data.size) chunks.push(item.data); };
      recorder.onstop = () => void processRecording();
      recorder.start();
      timer = window.setTimeout(finish, MAX_RECORDING_MS);
      setState('RELEASE · SEND', 'GROQ LISTENING');
    } catch (error) {
      releaseStream();
      setState('HOLD · GROQ', `MICROPHONE UNAVAILABLE: ${error?.message || 'permission denied'}`);
    }
  };

  const processRecording = async () => {
    window.clearTimeout(timer);
    releaseStream();
    busy = true;
    try {
      setState('TRANSCRIBING…', 'GROQ TRANSCRIBING');
      const form = new FormData();
      form.append('file', new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' }), 'world-viewer-voice.webm');
      form.append('model', 'whisper-large-v3-turbo');
      form.append('response_format', 'json');
      const transcription = await fetch('/api/groq/transcriptions', { method: 'POST', body: form });
      const transcriptBody = await transcription.json().catch(() => ({}));
      const transcript = String(transcriptBody.text || '').trim();
      if (!transcription.ok || !transcript) throw new Error(transcriptBody.error?.message || transcriptBody.error || 'No speech detected');

      setState('THINKING…', transcript.slice(0, 140));
      const completion = await fetch('/api/groq/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are WORLD VIEWER. Reply concisely with factual, uncertainty-aware intelligence assistance. Never claim live data you do not have.' },
            { role: 'user', content: transcript },
          ],
          max_tokens: 180,
          temperature: 0.3,
        }),
      });
      const completionBody = await completion.json().catch(() => ({}));
      const reply = String(completionBody?.choices?.[0]?.message?.content || '').replace(/\s+/g, ' ').trim();
      if (!completion.ok || !reply) throw new Error(completionBody.error?.message || completionBody.error || 'Groq did not return a reply');
      setState('HOLD · GROQ', reply.slice(0, 180));
      void speak(reply.slice(0, 500));
    } catch (error) {
      setState('HOLD · GROQ', `GROQ VOICE: ${error?.message || 'request failed'}`);
    } finally {
      busy = false;
      recorder = null;
      chunks = [];
      button.disabled = false;
    }
  };

  button.addEventListener('pointerdown', start);
  button.addEventListener('pointerup', finish);
  button.addEventListener('pointercancel', finish);
  button.addEventListener('pointerleave', (event) => { if (event.buttons) finish(); });
  return { stop: finish };
}
