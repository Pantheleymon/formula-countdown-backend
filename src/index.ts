import sharp from "sharp";
import express from "express";
import fs from "fs";
import { RaceApiResponse } from "@f1api/sdk";

/**
 * Интерфейс для расписания сессий гранпри
 */
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
    const scale = 2;

    const height: number =
      (req.query?.height ? parseInt(req.query?.height) : 1920) * scale;
    const width: number =
      (req.query?.width ? parseInt(req.query?.width) : 1060) * scale;

    const currentDate: Date = new Date();

    // TODO: добавить отображение трассы
    // const showMap: boolean = req.query?.showMap === "true";
    const showPractise: boolean = req.query?.showPractise === "true";
    const showSprint: boolean = req.query?.showSprint === "true";
    const showQualification: boolean = req.query?.showQualification === "true";
    const showRace: boolean = req.query?.showRace === "true";
    const showCountDown: boolean = req.query?.showCountDown === "true";

    // получаем данные о следующем гранпри
    const response = await fetch("https://f1api.dev/api/current/next");
    const data: RaceApiResponse = await response.json();

    const race = data?.race[0];

    // порядок отображения сессий
    const order: Array<keyof typeof race.schedule> = [
      "fp1",
      "fp2",
      "fp3",
      "sprintQualy",
      "sprintRace",
      "qualy",
      "race",
    ];

    // сортируем сессии в нужном порядке
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

    // ширина колонки для колоночной системы
    const columnWidth: number = width / 12;

    // отступ для системных элементов
    let y = (height / 8) * 3;
    let x = columnWidth * 2;

    // объявляем шрифты и конвертируем их в base64 для использования в svg
    const montserratRegular = fs
      .readFileSync(
        `${process.cwd()}/public/assets/fonts/Montserrat_Font_Family/Montserrat-Regular-400.ttf`,
      )
      .toString("base64");
    const montserratBold = fs
      .readFileSync(
        `${process.cwd()}/public/assets/fonts/Montserrat_Font_Family/Montserrat-Bold-700.ttf`,
      )
      .toString("base64");
    const montserratLight = fs
      .readFileSync(
        `${process.cwd()}/public/assets/fonts/Montserrat_Font_Family/Montserrat-Light-300.ttf`,
      )
      .toString("base64");

    console.log(montserratRegular, montserratBold, montserratLight);

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">

        <style>

          @font-face {
            font-family: "Montserrat";
            src: url(data:font/ttf;base64,${montserratRegular}) format('truetype');
            font-weight: 400;
          }

          @font-face {
            font-family: "Montserrat";
            src: url(data:font/ttf;base64,${montserratBold}) format('truetype');
            font-weight: 700;
          }

          @font-face {
            font-family: "Montserrat";
            src: url(data:font/ttf;base64,${montserratLight}) format('truetype');
            font-weight: 300;
          }

          text {
            font-family: "Montserrat";
          }

        </style>

        <rect width="100%" height="100%" fill="#0a0a0a"/>

        <text
          x="${x}"
          y="${y - 10}"
          font-size="20"
          font-weight="300"
          fill="white"
        >
          Round ${race.round} / ${race.raceName}
        </text>

        <text
          x="${x}"
          y="${y + 60}"
          font-size="72"
          font-weight="700"
          fill="white"
        >
          WEEKEND
        </text>

        <text
          x="${x}"
          y="${y + 120}"
          font-size="72"
          font-weight="300"
          fill="white"
        >
          SCHEDULE
        </text>

        ${createRows()}

      </svg>`;

    /**
     * Функция для создания строк сессий гранпри
     * @returns
     */
    function createRows(): string {
      let y = (height / 8) * 3 + 240;

      let rows: string = "";

      // выводим расписание сессий
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

        // дата и время сессии
        const sessionDate = new Date(`${date}T${time}`);

        let countdown = "";

        if (showCountDown) {
          // сколько дней осталось до сессии
          const diffTime = sessionDate.getTime() - currentDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          const label =
            diffDays > 0
              ? `in ${diffDays} days`
              : diffDays === 0
                ? "today"
                : "ended";

          countdown = `
            <text
              x="${x + columnWidth * 6}"
              y="${y}"
              font-size="32"
              font-weight="400"
              fill="white"
            >
              ${label}
            </text>
            `;
        }

        // форматируем дату
        const formattedDate = new Date(date)
          .toLocaleDateString("en-US", {
            day: "2-digit",
            month: "short",
          })
          .toUpperCase();

        // форматируем время
        const formattedTime = sessionDate.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

        // выводим дату и время
        rows += `
          <text
            x="${x}"
            y="${y}"
            font-size="48"
            font-weight="700"
            fill="white"
          >
            ${type.toUpperCase()}
          </text>

          ${countdown}

          <text
            x="${x}"
            y="${y + 40}"
            font-size="36"
            font-weight="300"
            fill="white"
          >
            ${formattedDate} - ${formattedTime}
          </text>`;

        y += 120;
      });

      return rows;
    }

    const buffer = await sharp(Buffer.from(svg)).png().toBuffer();

    res.set("Content-Type", "image/png");
    res.send(buffer);
  },
);

app.listen(3000, () => console.log("Server started"));
