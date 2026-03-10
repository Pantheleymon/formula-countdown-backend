import { createCanvas, registerFont } from "canvas";
import express from "express";
import { RaceApiResponse } from "@f1api/sdk";

export interface IRaceSchedule {
  type: string;
  date: string;
  time: string;
}

const app = express();

app.get(
  "/",
  async (
    req: {
      query: {
        height?: string;
        width?: string;
        showMap?: string;
        showPractise?: string;
        showSprint?: string;
        showQualification?: string;
        showRace?: string;
        showCountDown?: string;
      };
    },
    res: any,
  ) => {
    const height: number = req.query?.height
      ? parseInt(req.query?.height)
      : 1920;
    const width: number = req.query?.width ? parseInt(req.query?.width) : 1060;

    const currentDate: Date = new Date();

    // TODO: добавить отображение трассы
    // const showMap: boolean = req.query?.showMap === "true";
    const showPractise: boolean = req.query?.showPractise === "true";
    const showSprint: boolean = req.query?.showSprint === "true";
    const showQualification: boolean = req.query?.showQualification === "true";
    const showRace: boolean = req.query?.showRace === "true";
    const showCountDown: boolean = req.query?.showCountDown === "true";

    const response = await fetch("https://f1api.dev/api/current/next");
    const data: RaceApiResponse = await response.json();

    const race = data?.race[0];

    const order: Array<keyof typeof race.schedule> = [
      "fp1",
      "fp2",
      "fp3",
      "sprintQualy",
      "sprintRace",
      "qualy",
      "race",
    ];

    const sortedSchedule: IRaceSchedule[] = order.map((item): IRaceSchedule => {
      return {
        type: item,
        date: race?.schedule[item]?.date ?? "",
        time: race?.schedule[item]?.time ?? "",
      };
    });

    //TODO: добавить отображение трассы
    // const circuit = race?.circuit;
    // const circuitId = circuit?.circuitId;

    // TODO: Добавить отображение страны и автодрома
    // const circuitName = circuit?.circuitName;
    // const country = circuit?.country;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const columnWidth: number = width / 12;

    registerFont(
      __filename +
        "../../../assets/fonts/Montserrat_Font_Family/Montserrat Bold 700.ttf",
      {
        family: "Montserrat",
        weight: "bold",
      },
    );

    registerFont(
      __filename +
        "../../../assets/fonts/Montserrat_Font_Family/Montserrat Regular 400.ttf",
      {
        family: "Montserrat",
        weight: "normal",
      },
    );

    registerFont(
      __filename +
        "../../../assets/fonts/Montserrat_Font_Family/Montserrat Light 300.ttf",
      {
        family: "Montserrat",
        weight: "300",
      },
    );

    // фон
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, width, height);

    // отступ для системных элементов
    let y = (height / 8) * 3;
    let x = columnWidth * 2;

    // цвет для текста
    ctx.fillStyle = "white";

    // название гранпри
    ctx.font = "300 10px Montserrat";
    ctx.fillText(
      `Round ${race.round} / ${race.raceName}`,
      x,
      y,
      columnWidth * 8,
    );

    y += 40;

    // заголовок
    ctx.font = "bold 32px Montserrat";
    ctx.fillText("WEEKEND", x, y, columnWidth * 8);

    y += 30;

    ctx.font = "300 32px Montserrat";
    ctx.fillText("SCHEDULE", x, y, columnWidth * 8);

    y += 50;

    sortedSchedule.forEach(({ type, date, time }) => {
      if (!date || !time) {
        return;
      }

      if (type === "fp1" && !showPractise) {
        return;
      }
      if (type === "qualy" && !showQualification) {
        return;
      }
      if (type === "race" && !showRace) {
        return;
      }
      if ((type === "sprintRace" || type === "sprintQualy") && !showSprint) {
        return;
      }
      // тип сессии
      ctx.font = "bold 24px Montserrat";
      ctx.fillText(type.toUpperCase(), x, y, columnWidth * 6);

      const sessionDate = new Date(`${date}T${time}`);

      if (showCountDown) {
        // сколько дней осталось до сессии
        const diffTime = sessionDate.getTime() - currentDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        ctx.font = "normal 16px Montserrat";
        ctx.fillText(
          diffDays ? `in ${diffDays} days` : diffDays === 0 ? "today" : "ended",
          x + columnWidth * 6,
          y,
          columnWidth * 4,
        );
      }

      y += 20;

      // форматируем дату и время
      const formattedDate = new Date(date)
        .toLocaleDateString("en-US", {
          day: "2-digit",
          month: "short",
        })
        .toUpperCase();

      const formattedTime = sessionDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      // выводим дату
      ctx.font = "300 18px Montserrat";
      ctx.fillText(
        (formattedDate || "") + " - " + (formattedTime || ""),
        x,
        y,
        400,
      );

      y += 50;
    });

    // отправляем PNG
    const buffer = canvas.toBuffer("image/png");

    res.set("Content-Type", "image/png");
    res.send(buffer);
  },
);

app.listen(3000, () => console.log("Server started"));
