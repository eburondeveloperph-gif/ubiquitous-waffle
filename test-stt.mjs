import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ECHO_KEY = process.env.ECHO_PROVIDER_KEY || process.env.ELEVENLABS_API_KEY;

async function test() {
  const file = new Blob(["dummy audio content"], { type: "audio/wav" });
  const formData = new FormData();
  formData.append("file", file, "test.wav");

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": ECHO_KEY
    },
    body: formData
  });

  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}

test();
