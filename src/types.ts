/**
 * Интерфейс для расписания сессий гранпри
 */
export interface IRaceSchedule {
  type: string;
  date: string;
  time: string;
}

/**
 * Типы ответа api.jolpi.ca (зеркало Ergast API)
 */
export interface IErgastSession {
  date: string;
  time: string;
}

export interface IErgastRace {
  season: string;
  round: string;
  raceName: string;
  date: string;
  time: string;
  Circuit: {
    circuitId: string;
    circuitName: string;
    Location: {
      locality: string;
      country: string;
    };
  };
  FirstPractice?: IErgastSession;
  SecondPractice?: IErgastSession;
  ThirdPractice?: IErgastSession;
  Qualifying?: IErgastSession;
  Sprint?: IErgastSession;
  SprintQualifying?: IErgastSession;
}

export interface IErgastResponse {
  MRData: {
    RaceTable: {
      Races: IErgastRace[];
    };
  };
}

/**
 * Нормализованные данные гонки, с которыми работает отрисовка
 */
export interface INormalizedRace {
  round: string;
  raceName: string;
  circuit: {
    circuitId: string;
    circuitName: string;
    country: string;
    city: string;
  };
  schedule: {
    fp1: IErgastSession | null;
    fp2: IErgastSession | null;
    fp3: IErgastSession | null;
    sprintQualy: IErgastSession | null;
    sprintRace: IErgastSession | null;
    qualy: IErgastSession | null;
    race: IErgastSession;
  };
}
