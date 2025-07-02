// Este arquivo é a nossa Serverless Function.
// Ele recebe uma requisição do nosso frontend, busca os dados na ANEEL
// e os devolve com os headers de CORS corretos.

export default async function handler(request, response) {
  // Pega a URL da ANEEL que o frontend quer acessar. Ela vem como um parâmetro.
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
    // Faz a chamada real para a ANEEL do lado do servidor (sem problemas de CORS).
    const apiResponse = await fetch(targetUrl);

    // Se a resposta da ANEEL não for OK, repassa o erro.
    if (!apiResponse.ok) {
      throw new Error(
        `Erro na API da ANEEL: ${apiResponse.status} ${apiResponse.statusText}`
      );
    }

    const data = await apiResponse.json();

    // Configura os headers da nossa resposta para o frontend.
    // Permite que qualquer origem acesse (ideal para desenvolvimento).
    response.setHeader("Access-Control-Allow-Origin", "*");
    // Define o cache da resposta por 1 dia para melhorar a performance.
    response.setHeader(
      "Cache-Control",
      "s-maxage=86400, stale-while-revalidate"
    );

    // Envia os dados da ANEEL de volta para o nosso frontend.
    return response.status(200).json(data);
  } catch (error) {
    console.error("Erro no proxy:", error);
    return response
      .status(500)
      .json({ error: "Erro interno no servidor proxy." });
  }
}
