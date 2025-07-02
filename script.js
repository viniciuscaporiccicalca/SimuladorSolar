// Arquivo: script.js (Versão com jQuery/JSONP para o resource_id especificado)
$(document).ready(function () {
  // Elementos do DOM
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

  // Armazena os dados processados da ANEEL
  let dadosDistribuidoras = {};

  // O resource_id fornecido para as "Tarifas de Aplicação"
  const TARIFAS_RESOURCE_ID = "fcf2906c-7c32-4b9b-a637-054e7a5234f4";

  // Função para buscar cidades (API do IBGE)
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

  // Função principal para buscar e processar dados da ANEEL com JSONP
  function fetchAneelData() {
    // Utiliza a chamada AJAX com JSONP conforme solicitado
    return $.ajax({
      url: "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search",
      data: {
        resource_id: TARIFAS_RESOURCE_ID,
        q: '"B1" "Convencional"', // Adapta a consulta para buscar o subgrupo e modalidade corretos
        limit: 5000, // Aumenta o limite para garantir que todos os dados relevantes sejam retornados
        sort: "DatVigencia DESC", // Ordena pela data para pegar os mais recentes primeiro
      },
      dataType: "jsonp", // Utiliza JSONP para evitar erro de CORS
      success: function (data) {
        if (!data.success) {
          console.error("API da ANEEL retornou success: false");
          return;
        }

        const tarifasProcessadas = {};

        // Processa os resultados para obter a tarifa mais recente de cada distribuidora
        data.result.records.forEach((record) => {
          const distribuidora = record.SigAgente;

          // Como os dados já vêm ordenados, o primeiro que encontrarmos para cada agente será o mais recente.
          if (
            distribuidora &&
            !tarifasProcessadas[distribuidora] &&
            record.DscSubGrupo === "B1"
          ) {
            const estado = record.SigUF;
            const valorTE = parseFloat(record.VlrTUSD) || 0; // Tarifa de Energia
            const valorTUSD = parseFloat(record.VlrTE) || 0; // Tarifa de Uso do Sistema de Distribuição

            // Fator de impostos aproximado (PIS/COFINS e ICMS)
            const fatorImpostosAprox = 1 / (1 - 0.25);
            const tarifaFinal = (valorTE + valorTUSD) * fatorImpostosAprox;

            if (estado && !dadosDistribuidoras[estado]) {
              dadosDistribuidoras[estado] = [];
            }

            if (
              estado &&
              !dadosDistribuidoras[estado].some((d) => d.nome === distribuidora)
            ) {
              dadosDistribuidoras[estado].push({
                nome: distribuidora,
                tarifa: tarifaFinal,
              });
            }
            // Marca a distribuidora como processada para não sobrescrever com dados mais antigos
            tarifasProcessadas[distribuidora] = true;
          }
        });
      },
      error: function (jqXHR, textStatus, errorThrown) {
        console.error(
          "Falha ao buscar dados da ANEEL (JSONP):",
          textStatus,
          errorThrown
        );
        alert(
          "Não foi possível carregar os dados das distribuidoras. Tente recarregar a página."
        );
      },
    });
  }

  function popularEstados() {
    estadoSelect.html('<option value="" disabled selected>Estado</option>');
    const estados = Object.keys(dadosDistribuidoras).sort();
    estados.forEach((estado) => {
      estadoSelect.append(new Option(estado, estado));
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

  function popularDistribuidoras(estado) {
    distribuidoraSelect.html(
      '<option value="" disabled selected>Distribuidora</option>'
    );
    const distribuidorasDoEstado =
      dadosDistribuidoras[estado]?.sort((a, b) =>
        a.nome.localeCompare(b.nome)
      ) || [];
    distribuidorasDoEstado.forEach((dist) => {
      distribuidoraSelect.append(new Option(dist.nome, dist.nome));
    });
    distribuidoraSelect.prop("disabled", distribuidorasDoEstado.length === 0);
  }

  function atualizarConsumoEstimado() {
    const gastoMensal = parseFloat(gastoSlider.val());
    const tarifa = parseFloat(tarifaInput.val());
    if (gastoMensal > 0 && tarifa > 0) {
      consumoKwhDisplay.text(`${(gastoMensal / tarifa).toFixed(0)} kWh`);
    } else {
      consumoKwhDisplay.text("-- kWh");
    }
  }

  // Event Handlers
  estadoSelect.on("change", async function () {
    cidadeSelect.html("<option>Carregando...</option>").prop("disabled", true);
    distribuidoraSelect
      .html('<option value="" disabled selected>Distribuidora</option>')
      .prop("disabled", true);
    infoEnergiaSection.addClass("hidden");
    gastoMensalSection.addClass("hidden");
    verResultadoBtn.prop("disabled", true);

    const selectedState = $(this).val();
    popularDistribuidoras(selectedState);
    const cities = await fetchCitiesByState(selectedState);
    popularCidades(cities);
  });

  cidadeSelect.on("change", function () {
    if (distribuidoraSelect.val()) {
      verResultadoBtn.prop("disabled", false);
    }
  });

  distribuidoraSelect.on("change", function () {
    const selectedDistName = $(this).val();
    const selectedState = estadoSelect.val();
    const distribuidoraData = dadosDistribuidoras[selectedState]?.find(
      (d) => d.nome === selectedDistName
    );

    if (distribuidoraData) {
      fornecedorSpan.text(selectedDistName);
      tarifaInput.val(distribuidoraData.tarifa.toFixed(4));
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
    const dadosParaResultado = {
      acessoRede: $('input[name="acesso_rede"]:checked').val(),
      estado: estadoSelect.val(),
      cidade: cidadeSelect.val(),
      distribuidora: distribuidoraSelect.val(),
      tarifa: parseFloat(tarifaInput.val()),
      gastoMensal: parseFloat(gastoSlider.val()),
      consumoEstimado: consumoKwhDisplay.text(),
    };
    alert("Resultado pronto! (Confira os dados no console do navegador - F12)");
    console.log("--- DADOS PARA RESULTADO ---", dadosParaResultado);
  });

  // Função de inicialização
  function init() {
    estadoSelect
      .html("<option>Carregando dados...</option>")
      .prop("disabled", true);
    cidadeSelect.prop("disabled", true);
    distribuidoraSelect.prop("disabled", true);

    $.when(fetchAneelData()).done(function () {
      popularEstados();
      sliderValueDisplay.text(
        `R$ ${parseFloat(gastoSlider.val()).toLocaleString("pt-BR")}`
      );
    });
  }

  init();
});
