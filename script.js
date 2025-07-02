// script.js
document.addEventListener("DOMContentLoaded", () => {
  // Seleção dos elementos do DOM
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

  let distributorsByState = {};
  let tariffByDistributor = {};

  const AGENTES_RESOURCE_ID = "57a78e73-7711-422f-87d4-037130d2e5b4";
  const TARIFAS_RESOURCE_ID = "7f48a356-950c-4db3-94c7-1b033626245d";
  const API_ENDPOINT =
    "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search";

  async function fetchDistributorsAndStates() {
    const targetUrl = `${API_ENDPOINT}?resource_id=${AGENTES_RESOURCE_ID}&q=Distribui%C3%A7%C3%A3o&limit=500`;
    const url = `/api/proxy?targetUrl=${encodeURIComponent(targetUrl)}`;

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
    const targetUrl = `${API_ENDPOINT}?resource_id=${TARIFAS_RESOURCE_ID}&q="Convencional B1 Residencial"&limit=1000&sort=DatVigencia desc`;
    const url = `/api/proxy?targetUrl=${encodeURIComponent(targetUrl)}`;

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

  // O resto do código (lógica da UI e inicialização) permanece o mesmo.
  function popularEstados() {
    estadoSelect.innerHTML =
      '<option value="" disabled selected>Estado</option>';
    const t = Object.keys(distributorsByState).sort();
    t.forEach((t) => {
      estadoSelect.add(new Option(t, t));
    }),
      (estadoSelect.disabled = !1);
  }
  function popularDistribuidoras(t) {
    distribuidoraSelect.innerHTML =
      '<option value="" disabled selected>Distribuidora</option>';
    const o = distributorsByState[t]?.sort() || [];
    o.forEach((t) => {
      tariffByDistributor[t] && distribuidoraSelect.add(new Option(t, t));
    }),
      (distribuidoraSelect.disabled = !1);
  }
  function atualizarConsumoEstimado() {
    const t = parseFloat(gastoSlider.value),
      o = parseFloat(tarifaInput.value);
    t > 0 && o > 0
      ? (consumoKwhDisplay.textContent = `${(t / o).toFixed(0)} kWh`)
      : (consumoKwhDisplay.textContent = "-- kWh");
  }
  estadoSelect.addEventListener("change", () => {
    popularDistribuidoras(estadoSelect.value),
      infoEnergiaSection.classList.add("hidden"),
      gastoMensalSection.classList.add("hidden"),
      (verResultadoBtn.disabled = !0);
  }),
    distribuidoraSelect.addEventListener("change", () => {
      const t = distribuidoraSelect.value,
        o = tariffByDistributor[t];
      o &&
        ((fornecedorSpan.textContent = t),
        (tarifaInput.value = o.toFixed(4)),
        infoEnergiaSection.classList.remove("hidden"),
        gastoMensalSection.classList.remove("hidden"),
        (verResultadoBtn.disabled = !1),
        atualizarConsumoEstimado());
    }),
    gastoSlider.addEventListener("input", () => {
      (sliderValueDisplay.textContent = `R$ ${parseFloat(
        gastoSlider.value
      ).toLocaleString("pt-BR")}`),
        atualizarConsumoEstimado();
    }),
    verResultadoBtn.addEventListener("click", () => {
      const t = {
        acessoRede: document.querySelector('input[name="acesso_rede"]:checked')
          .value,
        estado: estadoSelect.value,
        distribuidora: distribuidoraSelect.value,
        tarifa: parseFloat(tarifaInput.value),
        gastoMensal: parseFloat(gastoSlider.value),
        consumoEstimado: consumoKwhDisplay.textContent,
      };
      alert(
        "Resultado pronto! (Confira os dados no console do navegador - F12)"
      ),
        console.log("--- DADOS PARA RESULTADO ---", t);
    }),
    (async function () {
      (estadoSelect.innerHTML = "<option>Carregando dados...</option>"),
        (estadoSelect.disabled = !0),
        (distribuidoraSelect.disabled = !0);
      const [t, o] = await Promise.all([
        fetchDistributorsAndStates(),
        fetchAllTariffs(),
      ]);
      t && o
        ? (popularEstados(),
          (sliderValueDisplay.textContent = `R$ ${parseFloat(
            gastoSlider.value
          ).toLocaleString("pt-BR")}`))
        : ((estadoSelect.innerHTML = "<option>Erro ao carregar</option>"),
          alert(
            "Falha ao carregar dados da ANEEL. Verifique o console (F12) e tente recarregar a página."
          ));
    })();
});
