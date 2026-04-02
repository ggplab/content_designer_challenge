export async function shortenUrl(url: string): Promise<string> {
  try {
    const resp = await fetch(
      `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`
    );
    if (!resp.ok) return url;
    const short = await resp.text();
    return short.trim().startsWith("https://is.gd/") ? short.trim() : url;
  } catch {
    return url;
  }
}
