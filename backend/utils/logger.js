// Structured JSON logger. Fields `severity` and `message` are recognised by Cloud Logging.
function write(severity, message, fields) {
  const entry = { severity, message, time: new Date().toISOString(), ...fields };
  const line = JSON.stringify(entry, (_k, v) =>
    v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v
  );
  (severity === 'ERROR' ? process.stderr : process.stdout).write(line + '\n');
}

module.exports = {
  info: (message, fields) => write('INFO', message, fields),
  warn: (message, fields) => write('WARNING', message, fields),
  error: (message, fields) => write('ERROR', message, fields),
};
