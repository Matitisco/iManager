import { describe, expect, it } from "vitest";
import { comparePatterns, problemMetrics, reasonFamilies, topReason } from "./patterns-math.js";

describe("familias de motivos sin cambiar el texto libre", () => {
  it.each([
    ["BATERÍA, baterías al 70%", ["bateria"]],
    ["PANTALLA / display", ["pantalla"]],
    ["No carga con el cargador", ["carga"]],
    ["Cámara empañada", ["camara"]],
    ["Micrófono y parlante sin audio", ["audio"]],
    ["FaceID / Face ID / face-id", ["face-id"]],
    ["Sin señal, wi-fi y bluetooth", ["conectividad"]],
    ["Botón, botones y táctil", ["botones-tactil"]],
    ["Mojado con agua", ["agua"]],
    ["Cambio por otro color", []],
    ["La pantalla muestra el estado de batería", ["bateria", "pantalla"]],
    ["Descargada / precarga", []],
  ])("%s", (reason, expected) => expect(reasonFamilies(reason as string)).toEqual(expected));

  it("requiere dos reclamos y no duplica una familia repetida en el mismo motivo", () => {
    expect(topReason(["batería batería baterías", "otro motivo"])).toBeNull();
    expect(topReason(["BATERÍA", "bateria al 70%", "pantalla"])).toEqual({ family: "bateria", label: "batería", claims: 2 });
    expect(topReason(["pantalla y batería", "batería y pantalla"])).toMatchObject({ family: "bateria", claims: 2 });
  });
});

describe("motivo principal en Fallas", () => {
  it("incluye un único reclamo y compara motivos libres contra familias", () => {
    expect(topReason(["Cámara empañada"], 1)).toMatchObject({ family: "camara", label: "cámara", claims: 1 });
    expect(topReason(["Se reinicia solo", "se reinicia solo", "Batería"], 1)).toMatchObject({ family: "otro", claims: 2 });
    expect(topReason(["", "   "], 1)).toBeNull();
  });
});

describe("métricas y orden", () => {
  it.each([
    [0, 0, 0, false], [1, 7, 14, false], [2, 8, 25, false], [2, 5, 40, true],
    [3, 20, 15, true], [4, 11, 36, true], [1, 3, 33, false], [19, 48, 40, true],
  ])("%i problemas / %i equipos", (problems, devices, percent, hot) => {
    expect(problemMetrics(problems, devices)).toEqual({ percent, hot });
  });

  it("usa el porcentaje real para el umbral y el porcentaje entero para mostrar", () => {
    expect(problemMetrics(2, 5)).toEqual({ percent: 40, hot: true });
    expect(problemMetrics(2, 6)).toEqual({ percent: 33, hot: false });
  });

  it("ordena problemas descendente, porcentaje descendente y clave estable", () => {
    const rows = [
      { key: "b", problems: 2, percent: 50 }, { key: "c", problems: 4, percent: 36 },
      { key: "d", problems: 2, percent: 25 }, { key: "a", problems: 2, percent: 50 },
    ];
    expect(rows.sort(comparePatterns).map(row => row.key)).toEqual(["c", "a", "b", "d"]);
  });
});
