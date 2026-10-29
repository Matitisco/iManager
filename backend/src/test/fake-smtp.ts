import { createServer, type Socket } from 'node:net';

/** Local capture transport: never relays mail or contacts a provider. */
export async function startFakeSmtp() {
  const messages: string[] = [];
  const sockets = new Set<Socket>();
  const server = createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.setEncoding('utf8');
    socket.write('220 localhost test SMTP\r\n');
    let buffer = '';
    let data: string[] | undefined;
    socket.on('data', chunk => {
      buffer += chunk;
      let end: number;
      while ((end = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (data) {
          if (line === '.') {
            messages.push(data.join('\r\n'));
            data = undefined;
            socket.write('250 captured\r\n');
          } else data.push(line.replace(/^\.\./, '.'));
        } else if (/^(EHLO|HELO)\b/i.test(line)) socket.write('250 localhost\r\n');
        else if (/^DATA$/i.test(line)) { data = []; socket.write('354 end with dot\r\n'); }
        else if (/^QUIT$/i.test(line)) socket.end('221 bye\r\n');
        else socket.write('250 OK\r\n');
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing fake SMTP port');
  return {
    port: address.port,
    messages,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}

export function decodeQuotedPrintable(message: string) {
  return message.replace(/=\r\n/g, '').replace(/(?:=[\da-f]{2})+/gi, encoded =>
    Buffer.from(encoded.replace(/=/g, ''), 'hex').toString('utf8'));
}
