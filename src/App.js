import logo from './logo.svg';
import './App.css';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

function MultiThreadVideoConvert() {
  const [loaded, setLoaded] = useState(false);
  const ffmpegRef = useRef(new FFmpeg());
  const videoRef = useRef(null);
  const messageRef = useRef(null);

  const load = async () => {
      const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/umd'
      const ffmpeg = ffmpegRef.current;
      ffmpeg.on('log', ({ message }) => {
          messageRef.current.innerHTML = message;
          console.log(message);
      });
      // toBlobURL is used to bypass CORS issue, urls with the same
      // domain can be used directly.
      await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
      });
      setLoaded(true);
  }

  const transcode = async () => {
      const ffmpeg = ffmpegRef.current;
      await ffmpeg.writeFile('input.webm', await fetchFile('https://raw.githubusercontent.com/ffmpegwasm/testdata/master/Big_Buck_Bunny_180_10s.webm'));
      await ffmpeg.exec(['-i', 'input.webm', 'output.mp4']);
      const data = await ffmpeg.readFile('output.mp4');
      videoRef.current.src =
          URL.createObjectURL(new Blob([data.buffer], {type: 'video/mp4'}));
  }

  return (loaded
      ? (
          <>
              <video ref={videoRef} controls></video><br/>
              <button onClick={transcode}>Transcode webm to mp4</button>
              <p ref={messageRef}></p>
              <p>Open Developer Tools (Ctrl+Shift+I) to View Logs</p>
          </>
      )
      : (
          <button onClick={load}>Load ffmpeg-core (~31 MB)</button>
      )
  );
}

export default App;
