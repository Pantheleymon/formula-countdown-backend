import express from "express";
import path from "path";
import { createCanvas, registerFont, loadImage } from "canvas";
import { RaceApiResponse } from "@f1api/sdk";

/**
 * Интерфейс для расписания сессий гранпри
 */
export interface IRaceSchedule {
  type: string;
  date: string;
  time: string;
}

// Подключаем необходимые шрифты
registerFont(path.join(__dirname, "fonts/Montserrat-Regular-400.ttf"), {
  family: "Montserrat",
  weight: "400",
});

registerFont(path.join(__dirname, "fonts/Montserrat-Light-300.ttf"), {
  family: "Montserrat",
  weight: "300",
});

registerFont(path.join(__dirname, "fonts/Montserrat-Bold-700.ttf"), {
  family: "Montserrat",
  weight: "700",
});

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
    const scale = 4;

    const height: number =
      (req.query?.height ? parseInt(req.query?.height) : 1920) * scale;
    const width: number =
      (req.query?.width ? parseInt(req.query?.width) : 1060) * scale;

    const currentDate: Date = new Date();

    const showMap: boolean = req.query?.showMap === "true";
    const showPractise: boolean = req.query?.showPractise === "true";
    const showSprint: boolean = req.query?.showSprint === "true";
    const showQualification: boolean = req.query?.showQualification === "true";
    const showRace: boolean = req.query?.showRace === "true";
    const showCountDown: boolean = req.query?.showCountDown === "true";

    // получаем данные о следующем гранпри
    const response = await fetch("https://f1api.dev/api/current/next");
    const data: RaceApiResponse = await response.json();

    const race = data?.race[0];

    if (!race) {
      return res.status(500).send("No race data");
    }

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

    // TODO: Добавить отображение страны и автодрома
    // const circuitName = circuit?.circuitName;
    // const country = circuit?.country;

    // ширина колонки для колоночной системы
    const columnWidth: number = width / 12;

    // создаем канвас и контекст для рисования
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // масштабируем и настраиваем канвас для лучшего качества

    ctx.antialias = "subpixel";
    ctx.patternQuality = "best";
    ctx.quality = "best";
    ctx.textDrawingMode = "path";

    ctx.imageSmoothingEnabled = true;

    // отступ для системных элементов
    let y = (height / 8) * 3;
    let x = columnWidth * 2;

    // фон
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, width, height);

    // цвет для текста
    ctx.fillStyle = "white";

    // название гранпри
    ctx.font = `300 ${10 * scale}px Montserrat`;
    ctx.fillText(
      `Round ${race.round} / ${race.raceName}`,
      x,
      y,
      columnWidth * 8,
    );

    y += 40 * scale;

    // заголовок "Weekend Schedule"
    ctx.font = `bold ${32 * scale}px Montserrat`;
    ctx.fillText("WEEKEND", x, y, columnWidth * 6);

    y += 30 * scale;

    ctx.font = `300 ${32 * scale}px Montserrat`;
    ctx.fillText("SCHEDULE", x, y, columnWidth * 6);

    // отображение карты трассы
    if (showMap) {
      const circuit = race?.circuit;
      const circuitId = circuit?.circuitId;

      const circuitPath = path.join(__dirname, "tracks", `${circuitId}-1.png`);

      try {
        const circuitMap = await loadImage(circuitPath);
        ctx.drawImage(
          circuitMap,
          x + columnWidth * 6,
          y - 60 * scale,
          columnWidth * 2,
          columnWidth * 2,
        );
      } catch (error) {
        console.error("Failed to load circuit map:", error);
      }
    }

    y += 50 * scale;

    createRows();

    /**
     * Функция для создания строк сессий гранпри
     * @returns
     */
    function createRows(): void {
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

        // тип сессии
        ctx.font = `bold ${24 * scale}px Montserrat`;
        ctx.fillText(type.toUpperCase(), x, y, columnWidth * 6);

        // дата и время сессии
        const sessionDate = new Date(`${date}T${time}`);

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

          ctx.font = `400 ${16 * scale}px Montserrat`;
          ctx.fillText(label, x + columnWidth * 6, y, columnWidth * 4);
        }

        y += 20 * scale;

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
        ctx.font = `300 ${18 * scale}px Montserrat`;
        ctx.fillText(
          (formattedDate || "") + " - " + (formattedTime || ""),
          x,
          y,
          columnWidth * 6,
        );

        y += 50 * scale;
      });
    }

    // отправляем PNG
    const buffer = canvas.toBuffer("image/png");

    res.set("Content-Type", "image/png");
    res.send(buffer);
  },
);

app.listen(3000, () => console.log("Server started"));
