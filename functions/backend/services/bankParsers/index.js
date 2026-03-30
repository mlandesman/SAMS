export async function parseBankFile(fileBuffer, bankFormat, _originalFilename) {
  if (bankFormat === 'scotiabank') {
    const { parseScotiabankCSV } = await import('./scotiabankParser.js');
    return parseScotiabankCSV(fileBuffer);
  }
  if (bankFormat === 'bbva') {
    const { parseBBVAXLSX } = await import('./bbvaParser.js');
    return parseBBVAXLSX(fileBuffer);
  }
  throw new Error(`Unsupported bank format: ${bankFormat}`);
}
