// Arquivo: script.js (com logs de diagnóstico)
document.addEventListener("DOMContentLoaded", () => {
  // Seleção dos elementos do DOM
  const estadoSelect = document.getElementById("estado");
  const cidadeSelect = document.getElementById("cidade");
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

  async function fetchDistributorsAndStates() {
    console.log("1.1. Iniciando fetchDistributorsAndStates...");
    const aneelApiBaseUrl =
      "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search";
    const params = new URLSearchParams({
      resource_id: AGENTES_RESOURCE_ID,
      q: "Distribuição",
      limit: 500,
    });
    const targetAneeUrl = `${aneelApiBaseUrl}?${params.toString()}`;
    const proxyUrl = `/api/proxy?targetUrl=${encodeURIComponent(
      targetAneeUrl
    )}`;
    console.log("1.2. URL do Proxy (Distribuidores):", proxyUrl);

    try {
      const response = await fetch(proxyUrl);
      console.log("1.3. Resposta do fetch (Distribuidores):", response);
      if (!response.ok) {
        throw new Error(
          `Status da resposta não foi OK: ${response.status} ${response.statusText}`
        );
      }
      const data = await response.json();
      console.log("1.4. Dados JSON recebidos (Distribuidores):", data);

      if (!data.success) {
        throw new Error(
          "API da ANEEL (Distribuidores) retornou success: false"
        );
      }

      distributorsByState = {};
      data.result.records.forEach((agent) => {
        const state = agent.SigUF;
        const distributorName = agent.SigAgente;
        if (state && distributorName) {
          if (!distributorsByState[state]) distributorsByState[state] = [];
          if (!distributorsByState[state].includes(distributorName)) {
            distributorsByState[state].push(distributorName);
          }
        }
      });
      console.log("1.5. Sucesso ao buscar distribuidores e estados.");
      return true;
    } catch (error) {
      console.error("ERRO CRÍTICO em fetchDistributorsAndStates:", error);
      return false;
    }
  }

  async function fetchAllTariffs() {
    console.log("2.1. Iniciando fetchAllTariffs...");
    const aneelApiBaseUrl =
      "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search";
    const params = new URLSearchParams({
      resource_id: TARIFAS_RESOURCE_ID,
      q: '"Convencional B1 Residencial"',
      limit: 1000,
      sort: "DatVigencia desc",
    });
    const targetAneeUrl = `${aneelApiBaseUrl}?${params.toString()}`;
    const proxyUrl = `/api/proxy?targetUrl=${encodeURIComponent(
      targetAneeUrl
    )}`;
    console.log("2.2. URL do Proxy (Tarifas):", proxyUrl);

    try {
      const response = await fetch(proxyUrl);
      console.log("2.3. Resposta do fetch (Tarifas):", response);
      if (!response.ok) {
        throw new Error(
          `Status da resposta não foi OK: ${response.status} ${response.statusText}`
        );
      }
      const data = await response.json();
      console.log("2.4. Dados JSON recebidos (Tarifas):", data);

      if (!data.success) {
        throw new Error("API da ANEEL (Tarifas) retornou success: false");
      }

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
      console.log("2.5. Sucesso ao buscar tarifas.");
      return true;
    } catch (error) {
      console.error("ERRO CRÍTICO em fetchAllTariffs:", error);
      return false;
    }
  }

  async function fetchCitiesByState(stateUF) {
    // ... (as outras funções não precisam de log agora, o foco é o carregamento inicial) ...
    if (!stateUF) return [];
    const ibgeApiUrl = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateUF}/municipios`;
    const proxyUrl = `/api/proxy?targetUrl=${encodeURIComponent(ibgeApiUrl)}`;
    try {
      const response = await fetch(proxyUrl);
      if (!response.ok)
        throw new Error(`Erro na rede (IBGE): ${response.status}`);
      const cities = await response.json();
      return cities.sort((a, b) => a.nome.localeCompare(b.nome));
    } catch (error) {
      console.error(`Falha ao buscar cidades para ${stateUF}:`, error);
      return [];
    }
  }

  function popularEstados() {
    console.log("4.1. Iniciando popularEstados()...");
    estadoSelect.innerHTML =
      '<option value="" disabled selected>Estado</option>';
    const t = Object.keys(distributorsByState).sort();
    console.log(`4.2. Encontrados ${t.length} estados para popular.`);
    t.forEach((t) => {
      estadoSelect.add(new Option(t, t));
    });
    estadoSelect.disabled = false;
    console.log("4.3. Estados populados com sucesso.");
  }

  // ... (restante do código sem alterações nos logs) ...
  function popularCidades(cities) {
    cidadeSelect.innerHTML =
      '<option value="" disabled selected>Cidade</option>';
    cities.forEach((city) => {
      cidadeSelect.add(new Option(city.nome, city.nome));
    });
    cidadeSelect.disabled = false;
  }

  function popularDistribuidoras(t) {
    distribuidoraSelect.innerHTML =
      '<option value="" disabled selected>Distribuidora</option>';
    const o = distributorsByState[t]?.sort() || [];
    o.forEach((t) => {
      if (tariffByDistributor[t]) {
        distribuidoraSelect.add(new Option(t, t));
      }
    });
    distribuidoraSelect.disabled = o.length === 0;
  }

  function atualizarConsumoEstimado() {
    const t = parseFloat(gastoSlider.value);
    const o = parseFloat(tarifaInput.value);
    if (t > 0 && o > 0) {
      consumoKwhDisplay.textContent = `${(t / o).toFixed(0)} kWh`;
    } else {
      consumoKwhDisplay.textContent = "-- kWh";
    }
  }

  estadoSelect.addEventListener("change", async () => {
    cidadeSelect.innerHTML = "<option>Carregando...</option>";
    cidadeSelect.disabled = true;
    distribuidoraSelect.innerHTML =
      '<option value="" disabled selected>Distribuidora</option>';
    distribuidoraSelect.disabled = true;
    infoEnergiaSection.classList.add("hidden");
    gastoMensalSection.classList.add("hidden");
    verResultadoBtn.disabled = true;

    const selectedState = estadoSelect.value;

    const [cities] = await Promise.all([
      fetchCitiesByState(selectedState),
      popularDistribuidoras(selectedState),
    ]);

    popularCidades(cities);
  });

  cidadeSelect.addEventListener("change", () => {
    if (distribuidoraSelect.value) {
      verResultadoBtn.disabled = false;
    }
  });

  distribuidoraSelect.addEventListener("change", () => {
    const t = distribuidoraSelect.value;
    const o = tariffByDistributor[t];
    if (o) {
      fornecedorSpan.textContent = t;
      tarifaInput.value = o.toFixed(4);
      infoEnergiaSection.classList.remove("hidden");
      gastoMensalSection.classList.remove("hidden");

      if (cidadeSelect.value) {
        verResultadoBtn.disabled = false;
      }
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
    const t = {
      acessoRede: document.querySelector('input[name="acesso_rede"]:checked')
        .value,
      estado: estadoSelect.value,
      cidade: cidadeSelect.value,
      distribuidora: distribuidoraSelect.value,
      tarifa: parseFloat(tarifaInput.value),
      gastoMensal: parseFloat(gastoSlider.value),
      consumoEstimado: consumoKwhDisplay.textContent,
    };
    alert("Resultado pronto! (Confira os dados no console do navegador - F12)");
    console.log("--- DADOS PARA RESULTADO ---", t);
  });

  (async function () {
    console.log("0. Inciando script de carregamento...");
    estadoSelect.innerHTML = "<option>Carregando dados...</option>";
    estadoSelect.disabled = true;
    cidadeSelect.disabled = true;
    distribuidoraSelect.disabled = true;

    console.log("3. Disparando Promise.all para buscar dados iniciais...");
    const [distribuidorasOk, tarifasOk] = await Promise.all([
      fetchDistributorsAndStates(),
      fetchAllTariffs(),
    ]);
    console.log(
      `3.1. Resultado da Promise.all: distribuidorasOk=${distribuidorasOk}, tarifasOk=${tarifasOk}`
    );

    if (distribuidorasOk && tarifasOk) {
      console.log(
        "4. Ambas as buscas foram bem-sucedidas. Populando estados..."
      );
      popularEstados();
      sliderValueDisplay.textContent = `R$ ${parseFloat(
        gastoSlider.value
      ).toLocaleString("pt-BR")}`;
    } else {
      console.error("ERRO: Uma ou ambas as buscas iniciais falharam.");
      estadoSelect.innerHTML = "<option>Erro ao carregar</option>";
      alert(
        "Falha ao carregar dados da ANEEL/IBGE. Verifique o console para mais detalhes."
      );
    }
  })();
});
