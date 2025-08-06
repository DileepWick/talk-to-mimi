/**
 * Helper function to wait until there's at least one message in the queue.
 * Optimized to reduce CPU usage with longer polling intervals.
 */
const waitMessage = async (queue) => {
  if (queue.length) return queue.shift();
  
  return new Promise((resolve) => {
    const checkQueue = () => {
      if (queue.length) {
        resolve(queue.shift());
      } else {
        // Increased from 10ms to 50ms to reduce CPU usage
        setTimeout(checkQueue, 50);
      }
    };
    checkQueue();
  });
};

/**
 * Handles a full conversation turn with timeout protection.
 * Collects Gemini response messages until `turnComplete` is received.
 */
export const handleTurn = async (queue, timeout = 30000) => {
  console.time("🔧 handleTurn - Processing Time");
  const messages = [];
  let complete = false;
  
  // Add timeout protection to prevent infinite waiting
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Gemini response timeout after 30s')), timeout)
  );
  
  try {
    while (!complete) {
      const msg = await Promise.race([
        waitMessage(queue),
        timeoutPromise
      ]);
      
      messages.push(msg);
      if (msg.serverContent?.turnComplete) complete = true;
    }
  } catch (error) {
    console.error('HandleTurn error:', error);
    throw error;
  }
  
  console.timeEnd("🔧 handleTurn - Processing Time");
  return messages;
};