document.addEventListener("DOMContentLoaded", () => {
  // --- ETAPA 1: SELEÇÃO DOS ELEMENTOS DO DOM ---
  // Cada uma destas variáveis PRECISA encontrar um elemento com o ID correspondente no index.html
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

  // Armazenará os dados vindos da API
  let distributorsByState = {};
  let tariffByDistributor = {};

  // IDs dos recursos da API ANEEL
  const AGENTES_RESOURCE_ID = "57a78e73-7711-422f-87d4-037130d2e5b4";
  const TARIFAS_RESOURCE_ID = "7f48a356-950c-4db3-94c7-1b033626245d";

  // URL do Proxy para contornar o erro de CORS
  const PROXY_URL = "https://cors-anywhere.herokuapp.com/";
  // Endpoint base da ANEEL
  const API_ENDPOINT =
    "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search";

  // --- ETAPA 2: FUNÇÕES DE LÓGICA DA API ---
  async function fetchDistributorsAndStates() {
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
          if (!distributorsByState[state]) distributorsByState[state] = [];
          if (!distributorsByState[state].includes(distributorName)) {
            distributorsByState[state].push(distributorName);
          }
        }
      });
      return true;
    } catch (error) {
      console.error("Falha na Etapa 1 (buscar distribuidoras):", error);
      return false;
    }
  }

  async function fetchAllTariffs() {
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
          tariffByDistributor[distributorName] =
            tarifaBaseKWh * fatorImpostosAprox;
        }
      });
      return true;
    } catch (error) {
      console.error("Falha na Etapa 2 (buscar tarifas):", error);
      return false;
    }
  }

  // --- ETAPA 3: FUNÇÕES DE LÓGICA DA UI ---
  function popularEstados() {
    estadoSelect.innerHTML =
      '<option value="" disabled selected>Estado</option>';
    const estados = Object.keys(distributorsByState).sort();
    estados.forEach((uf) => estadoSelect.add(new Option(uf, uf)));
    estadoSelect.disabled = false;
  }

  function popularDistribuidoras(uf) {
    distribuidoraSelect.innerHTML =
      '<option value="" disabled selected>Distribuidora</option>';
    const distribuidoras = distributorsByState[uf]?.sort() || [];
    distribuidoras.forEach((nome) => {
      if (tariffByDistributor[nome])
        distribuidoraSelect.add(new Option(nome, nome));
    });
    distribuidoraSelect.disabled = false;
  }

  function atualizarConsumoEstimado() {
    const gasto = parseFloat(gastoSlider.value);
    const tarifa = parseFloat(tarifaInput.value);
    if (gasto > 0 && tarifa > 0) {
      consumoKwhDisplay.textContent = `${(gasto / tarifa).toFixed(0)} kWh`;
    } else {
      consumoKwhDisplay.textContent = "-- kWh";
    }
  }

  // --- ETAPA 4: EVENT LISTENERS ---
  // O erro acontece aqui se alguma das variáveis da ETAPA 1 for 'null'.
  estadoSelect.addEventListener("change", () => {
    popularDistribuidoras(estadoSelect.value);
    infoEnergiaSection.classList.add("hidden");
    gastoMensalSection.classList.add("hidden");
    verResultadoBtn.disabled = true;
  });

  distribuidoraSelect.addEventListener("change", () => {
    const distribuidoraSelecionada = distribuidoraSelect.value;
    const tarifa = tariffByDistributor[distribuidoraSelecionada];
    if (tarifa) {
      fornecedorSpan.textContent = distribuidoraSelecionada;
      tarifaInput.value = tarifa.toFixed(4);
      infoEnergiaSection.classList.remove("hidden");
      gastoMensalSection.classList.remove("hidden");
      verResultadoBtn.disabled = false;
      atualizarConsumoEstimado();
    }
  });

  gastoSlider.addEventListener("input", () => {
    sliderValueDisplay.textContent = `R$ ${parseFloat(
      gastoSlider.value
    ).toLocaleString("pt-BR")}`;
    atualizarConsumoEstimado();
  });

  verResultadoBtn.addEventListener("click", () => {
    const resultado = {
      acessoRede: document.querySelector('input[name="acesso_rede"]:checked')
        .value,
      estado: estadoSelect.value,
      distribuidora: distribuidoraSelect.value,
      tarifa: parseFloat(tarifaInput.value),
      gastoMensal: parseFloat(gastoSlider.value),
      consumoEstimado: consumoKwhDisplay.textContent,
    };
    alert("Resultado pronto! (Confira os dados no console do navegador - F12)");
    console.log("--- DADOS PARA RESULTADO ---", resultado);
  });

  // --- ETAPA 5: INICIALIZAÇÃO ---
  async function init() {
    estadoSelect.innerHTML = `<option>Carregando dados...</option>`;
    estadoSelect.disabled = true;
    distribuidoraSelect.disabled = true;
    const [distributorsOk, tariffsOk] = await Promise.all([
      fetchDistributorsAndStates(),
      fetchAllTariffs(),
    ]);
    if (distributorsOk && tariffsOk) {
      popularEstados();
      sliderValueDisplay.textContent = `R$ ${parseFloat(
        gastoSlider.value
      ).toLocaleString("pt-BR")}`;
    } else {
      estadoSelect.innerHTML = `<option>Erro ao carregar</option>`;
      alert(
        "Falha ao carregar dados da ANEEL. Verifique o console (F12) e tente recarregar a página."
      );
    }
  }

  init();
});
