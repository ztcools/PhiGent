export class PubSub {
  handlers: { [index: string]: HandlerFunction[] };

  constructor() {
    this.handlers = {};
  }

  // 订阅
  on(eventType: string, handler: HandlerFunction) {
    if (!(eventType in this.handlers)) {
      this.handlers[eventType] = [];
    }
    this.handlers[eventType].push(handler);
    return this;
  }

  // 触发
  emit(eventType: string, ...handlerArgs: any[]) {
    // 获取事件触发时 handler 的参数
    // const handlerArgs = Array.prototype.slice.call(arguments, 1);
    if (!(eventType in this.handlers)) {
      console.warn(`eventType: ${eventType} missing`);
      return;
    }
    this.handlers[eventType].forEach(handler => {
      handler(...handlerArgs);
    });
    return this;
  }

  // 注销
  off(eventType: string, handler: HandlerFunction) {
    if (!(eventType in this.handlers)) {
      console.warn(`eventType: ${eventType} missing`);
      return;
    }
    // 移除 handler
    this.handlers[eventType] = this.handlers[eventType].filter(
      item => item !== handler
    );
    return this;
  }
}

type HandlerFunction = (...args: any) => void;

export const serverEvent = new PubSub();
