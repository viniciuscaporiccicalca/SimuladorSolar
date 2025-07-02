document.addEventListener("DOMContentLoaded", () => {
    // --- ELEMENTOS DO DOM ---
    const estadoSelect = document.getElementById("estado");
    const distribuidoraSelect = document.getElementById("distribuidora");
    const infoEnergiaSection = document.getElementById("info-energia");
    const fornecedorSpan = document.getElementById("fornecedor");
    const tarifaInput = document.getElementById("tarifa");
    const gastoMensalSection = document.getElementById("gasto-mensal");
    const gastoSlider = document.getElementById("gasto-slider");
    const sliderValueDisplay = document.getElementById("slider-value");
    const consumoKwhDisplay = document.getElementById("consumo-kwh");
    const verResultadoBtn = document.getElementById("ver-resultado");
  
    // Armazenará o mapeamento dinâmico: { "UF": ["Distribuidora 1", "Distribuidora 2"] }
    let distributorsByState = {};
    // Armazenará as tarifas encontradas: { "Distribuidora 1": 1.23, "Distribuidora 2": 4.56 }
    let tariffByDistributor = {};
  
    // --- IDs DOS RECURSOS DA API ANEEL ---
    // Tabela com a relação de Agentes (Distribuidoras) e seus respectivos estados (UF)
    const AGENTES_RESOURCE_ID = "57a78e73-7711-422f-87d4-037130d2e5b4";
    // Tabela com as tarifas (usada na segunda etapa)
    const TARIFAS_RESOURCE_ID = "7f48a356-950c-4db3-94c7-1b033626245d";
  
    // --- URL DO PROXY ---
    // Usado para contornar o erro de CORS do servidor da ANEEL durante o desenvolvimento local.
    const PROXY_URL = "https://cors-anywhere.herokuapp.com/";
    
    // Endpoint base da ANEEL, usado para todas as consultas.
    const API_ENDPOINT = "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search";
  
  
    /**
     * 1ª ETAPA DA API: Busca todas as distribuidoras e as agrupa por estado.
     * Utiliza o endpoint datastore_search com o resource_id dos Agentes.
     */
    async function fetchDistributorsAndStates() {
      console.log("API Etapa 1: Buscando distribuidoras por estado...");
      const url = `${PROXY_URL}${API_ENDPOINT}?resource_id=${AGENTES_RESOURCE_ID}&q=Distribui%C3%A7%C3%A3o&limit=500`;
  
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Erro na rede: ${response.status}`);
        const data = await response.json();
        if (!data.success) throw new Error("API de Agentes retornou erro.");
  
        const records = data.result.records;
        distributorsByState = {};
  
        records.forEach((agent) => {
          const state = agent.SigUF;
          const distributorName = agent.SigAgente;
  
          if (state && distributorName) {
              if (!distributorsByState[state]) {
                distributorsByState[state] = [];
              }
              if (!distributorsByState[state].includes(distributorName)) {
                distributorsByState[state].push(distributorName);
              }
          }
        });
  
        console.log("API Etapa 1: Mapeamento de distribuidoras por estado concluído.");
        return true;
      } catch (error) {
        console.error("Falha na Etapa 1 (buscar distribuidoras):", error);
        return false;
      }
    }
  
    /**
     * 2ª ETAPA DA API: Busca as tarifas para TODAS as distribuidoras encontradas.
     * Utiliza o endpoint datastore_search com o resource_id das Tarifas.
     */
    async function fetchAllTariffs() {
      console.log("API Etapa 2: Buscando tarifas...");
      const url = `${PROXY_URL}${API_ENDPOINT}?resource_id=${TARIFAS_RESOURCE_ID}&q="Convencional B1 Residencial"&limit=1000&sort=DatVigencia desc`;
  
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Erro na rede: ${response.status}`);
        const data = await response.json();
        if (!data.success) throw new Error("API de Tarifas retornou erro.");
  
        tariffByDistributor = {};
  
        data.result.records.forEach((record) => {
          const distributorName = record.SigAgente;
  
          if (distributorName && !tariffByDistributor[distributorName]) {
            const valorTE = parseFloat(record.VlrTE) || 0;
            const valorTUSD = parseFloat(record.VlrTUSD) || 0;
            const tarifaBaseKWh = (valorTE + valorTUSD) / 1000;
            
            const fatorImpostosAprox = 1 / (1 - 0.25);
            tariffByDistributor[distributorName] = tarifaBaseKWh * fatorImpostosAprox;
          }
        });
