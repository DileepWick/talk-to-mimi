
// Handle manual text input
export const handleSendMessageUtil = async ({ message, clientId, sendVoiceQuery, setMessage }) => {
  if (!message.trim()) {
    alert("Please enter a message");
    return;
  }

  if (!clientId) {
    alert("WebSocket not connected or clientId not received");
    return;
  }

  await sendVoiceQuery(message.trim());
  setMessage("");
};
