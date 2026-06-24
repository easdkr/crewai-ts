import { Flow, listen, start, type FlowContext, type FlowRuntime } from "../src/index.js";

type TypecheckState = {
  topic?: string;
  done?: boolean;
};

interface TypecheckFlow extends FlowRuntime<TypecheckState> {}

@Flow<TypecheckState>({
  initialState: () => ({ done: false }),
})
class TypecheckFlow {
  @start()
  begin(ctx: FlowContext<TypecheckState>, inputs: { topic: string }) {
    ctx.state.topic = inputs.topic;
    return inputs.topic;
  }

  @listen("begin")
  finish(ctx: FlowContext<TypecheckState>) {
    ctx.state.done = true;
    return ctx.state.topic;
  }
}

void new TypecheckFlow().kickoff({ inputs: { topic: "CrewAI" } });
