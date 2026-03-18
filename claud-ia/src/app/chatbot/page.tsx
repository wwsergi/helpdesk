export default function ChatbotTestPage() {
  return (
    <>
      <main className="chatbot-test-page">
        <div className="chatbot-test-card">
          <h1>Widget Demo</h1>
          <p>
            This page demonstrates the Claud-IA embeddable widget. Click the orange
            button in the bottom-right corner to open the chat.
          </p>
          <div className="chatbot-test-divider" />
          <h2>Embed snippet</h2>
          <p>Paste this single line before the <code>&lt;/body&gt;</code> tag of any website:</p>
          <pre className="chatbot-test-code">
            {`<script src="http://localhost:3001/embed.js"></script>`}
          </pre>
          <p className="chatbot-test-note">
            Replace <code>localhost:3000</code> with your production domain when deploying.
          </p>
        </div>
      </main>

      {/* The embed script — same code any external site would use */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/embed.js`} />
    </>
  );
}
