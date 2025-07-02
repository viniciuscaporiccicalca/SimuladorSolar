// Arquivo: /api/proxy.js
export default async function handler(request, response) {
  const { searchParams } = new URL(
    request.url,
    `http://${request.headers.host}`
  );
  const targetUrl = searchParams.get("targetUrl");
  if (!targetUrl) {
    return response
      .status(400)
      .json({ error: "O parâmetro targetUrl é obrigatório." });
  }
  try {
    const apiResponse = await fetch(targetUrl);
    if (!apiResponse.ok) {
      throw new Error(
        `Erro na API externa: ${apiResponse.status} ${apiResponse.statusText}`
      );
    }
    const data = await apiResponse.json();
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader(
      "Cache-Control",
      "s-maxage=86400, stale-while-revalidate"
    );
    return response.status(200).json(data);
  } catch (error) {
    console.error("Erro no proxy:", error);
    return response
      .status(500)
      .json({ error: "Erro interno no servidor proxy." });
  }
}
