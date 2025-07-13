
// WebSocket connection for ThingsBoard telemetry

export const openTelemetryWS = (token: string): WebSocket => {
  const wsUrl = `${import.meta.env.VITE_TB_BASE_URL?.replace('https://', 'wss://').replace('http://', 'ws://')}/api/ws/plugins/telemetry?token=${token}`;
  
  console.log('Connecting to WebSocket:', wsUrl);
  
  try {
    const ws = new WebSocket(wsUrl);
    
    // Add error handling
    ws.onerror = (error) => {
      console.error('WebSocket connection error:', error);
    };
    
    // Add connection timeout
    const timeout = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        console.warn('WebSocket connection timeout');
        ws.close();
      }
    }, 10000); // 10 second timeout
    
    ws.onopen = () => {
      clearTimeout(timeout);
      console.log('WebSocket connected successfully');
    };
    
    ws.onclose = (event) => {
      clearTimeout(timeout);
      console.log('WebSocket closed:', event.code, event.reason);
    };
    
    return ws;
  } catch (error) {
    console.error('Error creating WebSocket:', error);
    // Return a mock WebSocket that does nothing
    return {
      readyState: WebSocket.CLOSED,
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
      send: () => {},
      close: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      url: '',
      protocol: '',
      extensions: '',
      bufferedAmount: 0,
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    } as WebSocket;
  }
};
