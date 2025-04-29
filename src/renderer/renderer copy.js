import * as mediasoupClient from 'mediasoup-client';
import { io } from 'socket.io-client';

console.log('[Vite] Renderer loaded');

const socket = io('http://localhost:3000'); // Server ของคุณ

socket.on('connect', () => {
  console.log('[Socket.io] Connected');
});

socket.on('rtpCapabilities', async (rtpCapabilities) => {
  try {
    const device = new mediasoupClient.Device();
    await device.load({ routerRtpCapabilities: rtpCapabilities });

    const recvTransport = await device.createRecvTransport({
      id: 'consumer',
      iceParameters: {},
      iceCandidates: [],
      dtlsParameters: {}
    });

    socket.emit('createConsumer', { transportId: 'consumer' }, async (consumerData) => {
      const consumer = await recvTransport.consume({
        id: consumerData.id,
        producerId: consumerData.producerId,
        kind: consumerData.kind,
        rtpParameters: consumerData.rtpParameters
      });

      const video = document.getElementById('video');
      const stream = new MediaStream([consumer.track]);
      video.srcObject = stream;
      await video.play();
    });
  } catch (e) {
    console.error('Mediasoup setup error:', e);
  }
});
