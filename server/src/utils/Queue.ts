export class SimpleQueue<T> {
  private arr: T[] = []; // 存储数据并保持插入顺序的数组
  public isObseleted: boolean = false; // 标记队列是否已被废弃

  // 向队列中添加一项
  enqueue(item: T) {
    this.arr.push(item);
  }

  // 移除并返回队列中最早插入的一项
  dequeue(): T | undefined {
    return this.arr.shift();
  }

  // 获取队列中最后插入的一项
  getLatest(): T | undefined {
    return this.arr[this.arr.length - 1];
  }

  // 获取队列中最早插入的一项
  getEarliest(): T | undefined {
    return this.arr[0];
  }

  // 获取队列长度
  size(): number {
    return this.arr.length;
  }

  // 判断队列是否为空
  isEmpty(): boolean {
    return this.arr.length === 0;
  }

  // 清空队列
  stop() {
    this.arr = [];
    this.isObseleted = true; // 重置废弃标记
  }

  // 依次消费队列中的每一项，直到队列为空
  async executeNext(
    callback: (items: T[], q: SimpleQueue<T>) => Promise<void>,
    count: number = 1
  ) {
    if (this.isObseleted) {
      return; // 若已设置废弃标记，则直接返回
    }

    // 待处理的项
    const items: T[] = [];
    while (!this.isEmpty() && items.length < count) {
      const item = this.dequeue();
      if (item !== undefined) {
        items.push(item);
      }
    }
    // 执行回调
    if (items.length > 0) {
      await callback(items, this);
    }
  }
}
