import { PickleHandler } from "./file-handler.js";

export type TrainingData = Record<string, unknown>;
export type TrainingDataStore = Record<string, Record<string, unknown> | TrainingData>;

export class CrewTrainingHandler extends PickleHandler {
  saveTrainedData(agentId: string, trainedData: TrainingData): void {
    const data = this.loadTrainingData();
    data[agentId] = trainedData;
    this.save(data);
  }

  save_trained_data(agentId: string, trainedData: TrainingData): void {
    this.saveTrainedData(agentId, trainedData);
  }

  append(trainIteration: number, agentId: string, newData: unknown): void {
    const data = this.loadTrainingData();
    const existing = data[agentId];
    const agentData = existing && typeof existing === "object" && !Array.isArray(existing)
      ? existing as Record<string, unknown>
      : {};
    agentData[String(trainIteration)] = newData;
    data[agentId] = agentData;
    this.save(data);
  }

  clear(): void {
    this.save({});
  }

  private loadTrainingData(): TrainingDataStore {
    const data = this.load();
    return data && typeof data === "object" && !Array.isArray(data)
      ? data as TrainingDataStore
      : {};
  }
}
