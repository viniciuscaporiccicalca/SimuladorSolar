// Arquivo: script.js (Versão otimizada com API SQL e JSONP)
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

  // Função principal para buscar e processar dados da ANEEL via SQL e JSONP
  function fetchAneelData() {
    // Query SQL para buscar as tarifas B1 Convencionais mais recentes para cada distribuidora
    const sqlQuery = `
      WITH TarifasRecentes AS (
        SELECT
          "SigAgente", "VlrTE", "VlrTUSD", "DatVigencia",
          ROW_NUMBER() OVER(PARTITION BY "SigAgente" ORDER BY "DatVigencia" DESC) as rn
        FROM "7f48a356-950c-4db3-94c7-1b0336245d"
        WHERE "NomSubgrupo" = 'B1' AND "DscModalidadeTarifaria" = 'Convencional'
      )
      SELECT
        agentes."SigUF" AS estado,
        agentes."SigAgente" AS distribuidora,
        (tarifas."VlrTE" + tarifas."VlrTUSD") / 1000 * (1 / (1 - 0.25)) AS tarifa_final_kwh
      FROM "57a78e73-7711-422f-87d4-037130d2e5b4" AS agentes
      JOIN TarifasRecentes AS tarifas ON agentes."SigAgente" = tarifas."SigAgente"
      WHERE tarifas.rn = 1 AND agentes."NomTipoAgente" = 'Distribuição'
      ORDER BY estado, distribuidora
    `;

    return $.ajax({
      url: "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search_sql",
      data: {
        sql: sqlQuery,
      },
      dataType: "jsonp", // A chave da solução: Usa JSONP para evitar erros de CORS
      cache: true,
      success: function (data) {
        if (!data.success) {
          console.error("API da ANEEL (SQL) retornou success: false");
          return;
        }
        // Processa os resultados e agrupa por estado
        data.result.records.forEach((record) => {
          const { estado, distribuidora, tarifa_final_kwh } = record;
          if (estado && distribuidora && tarifa_final_kwh) {
            if (!dadosDistribuidoras[estado]) {
              dadosDistribuidoras[estado] = [];
            }
            dadosDistribuidoras[estado].push({
              nome: distribuidora,
              tarifa: tarifa_final_kwh,
            });
          }
        });
      },
      error: function (jqXHR, textStatus, errorThrown) {
        console.error(
          "Falha ao buscar dados da ANEEL (SQL/JSONP):",
          textStatus,
          errorThrown
        );
        alert(
          "Não foi possível carregar os dados das distribuidoras. Verifique o console e tente recarregar a página."
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
    const distribuidorasDoEstado = dadosDistribuidoras[estado] || [];
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
