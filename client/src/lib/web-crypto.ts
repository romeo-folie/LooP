// Generate an AES-GCM key (256-bit)
export async function generateKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true, // extractable so we can export it if needed
    ["encrypt", "decrypt"]
  );
}

// Encrypt function: accepts a plaintext string and a CryptoKey.
// It returns an object containing the IV and the ciphertext as Uint8Arrays.
export async function encrypt(
  plaintext: string | undefined,
  key: CryptoKey
): Promise<{
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: Uint8Array<ArrayBuffer>;
}> {
  // Convert string to Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate a random initialization vector; 12 bytes is recommended for AES-GCM.
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the data
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv, // use the generated IV
    },
    key,
    data
  );

  // Convert the ArrayBuffer to a Uint8Array for easier storage
  const ciphertext = new Uint8Array(encryptedBuffer);

  // Return both the IV and ciphertext. You'll need the IV for decryption.
  return { iv, ciphertext };
}

// Decrypt function: accepts an object containing the IV and ciphertext along with the CryptoKey.
// It returns the decrypted plaintext string.
export async function decrypt(
  {
    iv,
    ciphertext,
  }: { iv: Uint8Array<ArrayBuffer>; ciphertext: Uint8Array<ArrayBuffer> },
  key: CryptoKey
): Promise<string> {
  // Decrypt the data using the same IV and key
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv, // must be the same IV used during encryption
    },
    key,
    ciphertext
  );

  // Convert the decrypted ArrayBuffer back into a string
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}
