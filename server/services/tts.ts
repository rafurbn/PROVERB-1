import fs from 'fs';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import type { TtsProvider } from '../types.ts';

export const EDGE_TTS_VOICE = 'bn-BD-NabanitaNeural';

function buildBengaliNarrationScript(proverbBn: string, meaningBn: string): string {
  const cleanProverb = proverbBn.trim().replace(/[।.]+$/, '');
  const cleanMeaning = meaningBn.trim().replace(/[।.]+$/, '');
  return `${cleanProverb}। এর অর্থ হলো: ${cleanMeaning}।`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Primary TTS: Microsoft Edge Neural Voice (bn-BD-NabanitaNeural)
 */
async function synthesizeWithEdgeTts(script: string): Promise<Buffer> {
  const tts = new MsEdgeTTS({
    connectionTimeoutMs: 15000,
    synthesisTimeoutMs: 30000,
  });

  try {
    await tts.setMetadata(EDGE_TTS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(escapeXml(script));

    const audioBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      audioStream.on('data', (chunk: Buffer | Uint8Array) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      audioStream.on('error', (err: Error) => reject(err));
      audioStream.on('end', () => resolve(Buffer.concat(chunks)));
    });

    if (audioBuffer.length === 0) {
      throw new Error('Edge TTS returned an empty audio stream.');
    }
    return audioBuffer;
  } finally {
    tts.close();
  }
}

/**
 * Secondary Free Fallback TTS: Google Translate Bengali TTS (chunked <= 170 chars per request)
 * Useful when cloud/datacenter IPs encounter Edge TTS rate limits or 403 blocks.
 */
function splitIntoTtsChunks(text: string, maxLen = 170): string[] {
  const sentences = text.split(/(?<=[।?!,;:])\s*/).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).trim().length <= maxLen) {
      current = (current + ' ' + sentence).trim();
    } else {
      if (current) chunks.push(current);
      if (sentence.length <= maxLen) {
        current = sentence;
      } else {
        const words = sentence.split(/\s+/);
        let part = '';
        for (const w of words) {
          if ((part + ' ' + w).trim().length <= maxLen) {
            part = (part + ' ' + w).trim();
          } else {
            if (part) chunks.push(part);
            part = w;
          }
        }
        current = part;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function synthesizeWithGoogleTts(script: string): Promise<Buffer> {
  const chunks = splitIntoTtsChunks(script, 170);
  const audioParts: Buffer[] = [];

  for (const chunk of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=bn&client=tw-ob&q=${encodeURIComponent(
      chunk
    )}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) {
      throw new Error(`Google TTS HTTP ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) {
      throw new Error('Google TTS returned an empty chunk.');
    }
    audioParts.push(buf);
  }

  return Buffer.concat(audioParts);
}

/**
 * Optional Third Fallback TTS: ElevenLabs Multilingual v2
 */
async function synthesizeWithElevenLabs(script: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();

  if (!apiKey || !voiceId) {
    throw new Error('ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID are not configured.');
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: script,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.78,
          style: 0.25,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${errText}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

export async function generateBengaliVoiceover(options: {
  proverbBn: string;
  meaningBn: string;
  outputPathWithoutExt: string;
}): Promise<{ filePath: string; providerUsed: TtsProvider }> {
  const script = buildBengaliNarrationScript(options.proverbBn, options.meaningBn);
  const filePath = `${options.outputPathWithoutExt}.mp3`;

  try {
    const audioBuffer = await synthesizeWithEdgeTts(script);
    fs.writeFileSync(filePath, audioBuffer);
    return { filePath, providerUsed: 'edge-tts' };
  } catch (edgeErr) {
    const edgeMsg = edgeErr instanceof Error ? edgeErr.message : String(edgeErr);
    console.warn(`[tts] Edge TTS (${EDGE_TTS_VOICE}) failed, trying ElevenLabs / Google TTS:`, edgeMsg);

    const hasElevenLabs = Boolean(
      process.env.ELEVENLABS_API_KEY?.trim() && process.env.ELEVENLABS_VOICE_ID?.trim()
    );

    if (hasElevenLabs) {
      try {
        const elevenBuf = await synthesizeWithElevenLabs(script);
        fs.writeFileSync(filePath, elevenBuf);
        return { filePath, providerUsed: 'elevenlabs' };
      } catch (elevenErr) {
        console.warn('[tts] ElevenLabs fallback failed, trying Google TTS:', elevenErr);
      }
    }

    try {
      const googleBuf = await synthesizeWithGoogleTts(script);
      fs.writeFileSync(filePath, googleBuf);
      return { filePath, providerUsed: 'google-tts' };
    } catch (googleErr) {
      const gMsg = googleErr instanceof Error ? googleErr.message : String(googleErr);
      throw new Error(`All Bengali TTS providers failed. Edge: ${edgeMsg} | Google: ${gMsg}`);
    }
  }
}
