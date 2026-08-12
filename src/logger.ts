/**
 * A thin structured logger over `console`. One JSON line per record so the
 * output is greppable and machine-parseable, with a level threshold from
 * `LOG_LEVEL` (`debug | info | warn | error | silent`) — tests set `silent`
 * to keep their output pristine.
 */

type Fields = Record<string, unknown>;
type Level = 'debug' | 'info' | 'warn' | 'error';

const RANK: Record<Level | 'silent', number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const SINK: Record<Level, (line: string) => void> = {
  debug: console.log,
  info: console.log,
  warn: console.warn,
  error: console.error,
};

export interface Logger {
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
  child(bindings: Fields): Logger;
}

class ConsoleLogger implements Logger {
  constructor(private readonly bindings: Fields = {}) {}

  debug(msg: string, fields?: Fields): void {
    this.write('debug', msg, fields);
  }

  info(msg: string, fields?: Fields): void {
    this.write('info', msg, fields);
  }

  warn(msg: string, fields?: Fields): void {
    this.write('warn', msg, fields);
  }

  error(msg: string, fields?: Fields): void {
    this.write('error', msg, fields);
  }

  child(bindings: Fields): Logger {
    return new ConsoleLogger({ ...this.bindings, ...bindings });
  }

  private write(level: Level, msg: string, fields?: Fields): void {
    if (RANK[level] < threshold()) return;
    SINK[level](
      JSON.stringify({
        level,
        time: new Date().toISOString(),
        msg,
        ...this.bindings,
        ...fields,
      }),
    );
  }
}

function threshold(): number {
  const level = process.env.LOG_LEVEL;
  return level && level in RANK ? RANK[level as Level | 'silent'] : RANK.info;
}

export function makeLogger(bindings: Fields = {}): Logger {
  return new ConsoleLogger(bindings);
}

export const logger = makeLogger();
