// Arquivo: script.js (Versão com jQuery/Ajax/JSONP)
$(document).ready(function () {
  const estadoSelect = $("#estado");
  const cidadeSelect = $("#cidade");
  const distribuidoraSelect = $("#distribuidora");
  const infoEnergiaSection = $("#info-energia");
  const fornecedorSpan = $("#fornecedor");
  const tarifaInput = $("#tarifa");
  const gastoMensalSection = $("#gasto-mensal");
  const gastoSlider = $("#gasto-slider");
  const sliderValueDisplay = $("#slider-value");
  const consumoKwhDisplay = $("#consumo-kwh");
  const verResultadoBtn = $("#ver-resultado");

  let distributorsByState = {};
  let tariffByDistributor = {};

  const AGENTES_RESOURCE_ID = "57a78e73-7711-422f-87d4-037130d2e5b4";
  const TARIFAS_RESOURCE_ID = "7f48a356-950c-4db3-94c7-1b033626245d";

  // Função para buscar distribuidores com jQuery/JSONP
  function fetchDistributorsAndStates() {
    return $.ajax({
      url: "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search",
      data: {
        resource_id: AGENTES_RESOURCE_ID,
        q: "Distribuição",
        limit: 500,
      },
      dataType: "jsonp",
      success: function (data) {
        if (!data.success) {
          console.error(
            "API da ANEEL (Distribuidores) retornou success: false"
          );
          return;
        }
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
      },
      error: function (jqXHR, textStatus, errorThrown) {
        console.error(
          "Falha na Etapa 1 (buscar distribuidoras):",
          textStatus,
          errorThrown
        );
      },
    });
  }

  // Função para buscar tarifas com jQuery/JSONP
  function fetchAllTariffs() {
    return $.ajax({
      url: "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search",
      data: {
        resource_id: TARIFAS_RESOURCE_ID,
        q: '"Convencional B1 Residencial"',
        limit: 1000,
        sort: "DatVigencia desc",
      },
      dataType: "jsonp",
      success: function (data) {
        if (!data.success) {
          console.error("API da ANEEL (Tarifas) retornou success: false");
          return;
        }
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
      },
      error: function (jqXHR, textStatus, errorThrown) {
        console.error(
          "Falha na Etapa 2 (buscar tarifas):",
          textStatus,
          errorThrown
        );
      },
    });
  }

  // Função para buscar cidades (API do IBGE permite acesso direto com fetch)
  async function fetchCitiesByState(stateUF) {
    if (!stateUF) return [];
    const ibgeApiUrl = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateUF}/municipios`;
    try {
      const response = await fetch(ibgeApiUrl);
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
    estadoSelect.html('<option value="" disabled selected>Estado</option>');
    const t = Object.keys(distributorsByState).sort();
    t.forEach((t) => {
      estadoSelect.append(new Option(t, t));
    });
    estadoSelect.prop("disabled", false);
  }

  function popularCidades(cities) {
    cidadeSelect.html('<option value="" disabled selected>Cidade</option>');
    cities.forEach((city) => {
      cidadeSelect.append(new Option(city.nome, city.nome));
    });
    cidadeSelect.prop("disabled", false);
  }

  function popularDistribuidoras(t) {
    distribuidoraSelect.html(
      '<option value="" disabled selected>Distribuidora</option>'
    );
    const o = distributorsByState[t]?.sort() || [];
    o.forEach((t) => {
      if (tariffByDistributor[t]) {
        distribuidoraSelect.append(new Option(t, t));
      }
    });
    distribuidoraSelect.prop("disabled", o.length === 0);
  }

  function atualizarConsumoEstimado() {
    const t = parseFloat(gastoSlider.val());
    const o = parseFloat(tarifaInput.val());
    if (t > 0 && o > 0) {
      consumoKwhDisplay.text(`${(t / o).toFixed(0)} kWh`);
    } else {
      consumoKwhDisplay.text("-- kWh");
    }
  }

  estadoSelect.on("change", async function () {
    cidadeSelect.html("<option>Carregando...</option>").prop("disabled", true);
    distribuidoraSelect
      .html('<option value="" disabled selected>Distribuidora</option>')
      .prop("disabled", true);
    infoEnergiaSection.addClass("hidden");
    gastoMensalSection.addClass("hidden");
    verResultadoBtn.prop("disabled", true);

    const selectedState = $(this).val();

    const cities = await fetchCitiesByState(selectedState);
    popularCidades(cities);
    popularDistribuidoras(selectedState);
  });

  cidadeSelect.on("change", function () {
    if (distribuidoraSelect.val()) {
      verResultadoBtn.prop("disabled", false);
    }
  });

  distribuidoraSelect.on("change", function () {
    const t = $(this).val();
    const o = tariffByDistributor[t];
    if (o) {
      fornecedorSpan.text(t);
      tarifaInput.val(o.toFixed(4));
      infoEnergiaSection.removeClass("hidden");
      gastoMensalSection.removeClass("hidden");

      if (cidadeSelect.val()) {
        verResultadoBtn.prop("disabled", false);
      }
      atualizarConsumoEstimado();
    }
  });

  gastoSlider.on("input", function () {
    sliderValueDisplay.text(
      `R$ ${parseFloat($(this).val()).toLocaleString("pt-BR")}`
    );
    atualizarConsumoEstimado();
  });

  verResultadoBtn.on("click", function () {
    const t = {
      acessoRede: $('input[name="acesso_rede"]:checked').val(),
      estado: estadoSelect.val(),
      cidade: cidadeSelect.val(),
      distribuidora: distribuidoraSelect.val(),
      tarifa: parseFloat(tarifaInput.val()),
      gastoMensal: parseFloat(gastoSlider.val()),
      consumoEstimado: consumoKwhDisplay.text(),
    };
    alert("Resultado pronto! (Confira os dados no console do navegador - F12)");
    console.log("--- DADOS PARA RESULTADO ---", t);
  });

  // Função de inicialização
  function init() {
    estadoSelect
      .html("<option>Carregando dados...</option>")
      .prop("disabled", true);
    cidadeSelect.prop("disabled", true);
    distribuidoraSelect.prop("disabled", true);

    $.when(fetchDistributorsAndStates(), fetchAllTariffs())
      .done(function () {
        popularEstados();
        sliderValueDisplay.text(
          `R$ ${parseFloat(gastoSlider.val()).toLocaleString("pt-BR")}`
        );
      })
      .fail(function () {
        estadoSelect.html("<option>Erro ao carregar</option>");
        alert(
          "Falha ao carregar dados da ANEEL. Verifique o console do navegador para mais detalhes."
        );
      });
  }

  init();
});
