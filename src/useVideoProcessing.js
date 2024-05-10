import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { useRef, useState } from "react";

export const useVideoProcessing = () => {
  const DEFAULT_FPS = 30;
  const [file, setFile] = useState(null);
  const [interpolate, setInterpolate] = useState(false);
  const [sliderValue, setSliderValue] = useState(DEFAULT_FPS);
  const [loaded, setLoaded] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [videoURL, setVideoURL] = useState("");
  const ffmpegRef = useRef(new FFmpeg());
  const messageRef = useRef(null);
  const logsRef = useRef([]);
  const droppedFramesRef = useRef([]);

  const loadFFmpeg = async ({ logging = false } = {}) => {
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    const ffmpeg = ffmpegRef.current;

    try {
      if (logging) {
        ffmpeg.on("log", ({ message }) => {
          if (messageRef.current) {
            messageRef.current.innerHTML = message;
          }
          if (message.includes("mpdecimate")) {
            logsRef.current.push(message);
            console.log(message);
          }
        });
      } else {
        ffmpeg.on("progress", ({ progress, time }) => {
          if (messageRef.current) {
            messageRef.current.innerHTML = `${
              progress * 100
            } % (transcoded time: ${time / 1000000} s)`;
          }
        });
      }

      await ffmpeg.load({
        coreURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.js`,
          "text/javascript"
        ),
        wasmURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.wasm`,
          "application/wasm"
        ),
      });

      setLoaded(true);
    } catch (error) {
      console.error("Error loading FFmpeg:", error);
      if (messageRef.current) {
        messageRef.current.innerHTML =
          "Failed to load FFmpeg. Please check the console for more details.";
      }
    }
  };

  const defineSilenceFrames = async ({ file }) => {
    if (!file) {
      console.error("No file provided for transcoding.");
      return;
    }
    setVideoURL("");
    const ffmpeg = ffmpegRef.current;

    const video_filter = `fps=1,format=gray,lutyuv='y=if(gt(val,128), 1,0)',scale=320:-1,mpdecimate=hi=64:lo=30:frac=0.33,setpts=N/FRAME_RATE/TB,fps=1`;

    try {
      // const logs = [];
      // ffmpeg.setLogger(({ type, message }) => {
      //   if (type === "fferr") {
      //     console.log(message);
      //     logs.push(message);
      //   }
      // });

      await ffmpeg.writeFile("input.mp4", await fetchFile(file));
      await ffmpeg.exec([
        "-i",
        "input.mp4",
        "-vf",
        video_filter,
        "-an",
        "output.mp4",
        "-loglevel",
        "debug",
      ]);

      processLogs(logsRef.current);

      // const data = await ffmpeg.readFile("output.mp4");

      // const url = URL.createObjectURL(
      //   new Blob([data.buffer], { type: "video/mp4" })
      // );
      // setVideoURL(url);

      // console.log(ffmpeg.FS("readFile", "ffmpeg.log").toString());
    } catch (error) {
      console.error("Error during the transcoding process:", error);
      alert("Failed to process video due to an error.");
    }
  };

  const processLogs = () => {
    const logs = logsRef.current;
    let raw_logs = [];
    const regex = /(keep|drop)\spts:.*\spts_time:(\d+)/;
    logs.forEach((log) => {
      const match = log.match(regex);
      if (match) {
        raw_logs.push(`${match[1]} pts_time:${match[2]}`);
      }
    });
    raw_logs.push(`keep pts_time:${raw_logs.length}`);
    let lastType = "";
    let processed_logs = [];
    raw_logs.forEach((raw_log) => {
      const currentType = raw_log.split(" ")[0];

      if (currentType !== lastType) {
        processed_logs.push(raw_log);
        console.log(raw_log);
        lastType = currentType;
      }
    });

    calculateDroppedPeriods(processed_logs, {
      durationThreshold: 3,
    });
  };

  const calculateDroppedPeriods = (lines, { durationThreshold = 5 } = {}) => {
    // Prepare to collect results and track total dropped time
    let results = [];
    let totalDropped = 0;

    // Process each pair of adjacent lines
    for (let i = 0; i < lines.length - 1; i++) {
      const current = lines[i];
      const next = lines[i + 1];

      const currentParts = current.split(" pts_time:");
      const nextParts = next.split(" pts_time:");

      const currentType = currentParts[0];

      // Check if a 'drop' entry is followed by a 'keep' entry
      if (currentType === "drop") {
        const currentTime = parseInt(currentParts[1], 10);
        const nextTime = parseInt(nextParts[1], 10);

        const duration = nextTime - currentTime;
        totalDropped += duration;

        if (duration > durationThreshold) {
          results.push([currentTime, nextTime]);
          console.log(`drop, start: ${currentTime}, end: ${nextTime}`);
        }
      }
    }
    droppedFramesRef.current = results;
    console.log(`Total frames dropped: ${totalDropped}`);
  };

  const dropFrames = async ({ file }) => {
    // Prepare the input file
    const dropRanges = droppedFramesRef.current;
    console.log(dropRanges);
    const ffmpeg = ffmpegRef.current;

    try {
      ffmpeg.writeFile("input.mp4", await fetchFile(file));

      // Construct the filter to keep frames outside the drop ranges
      const keepFilter = dropRanges
        .map((range) => `not(between(t,${range[0]},${range[1]}))`)
        .join("*");
      console.log(keepFilter);

      // Command to apply filters and output the processed video
      await ffmpeg.exec([
        "-i",
        "input.mp4",
        "-vf",
        `select='${keepFilter}',setpts=N/FRAME_RATE/TB`,
        "-an",
        "output.mp4",
      ]);
      const videoData = await ffmpeg.readFile("output.mp4");
      setVideoURL(
        URL.createObjectURL(new Blob([videoData.buffer], { type: "video/mp4" }))
      );
    } catch (error) {
      console.error("Error during the frame dropping process:", error);
      alert(
        "An error occurred while processing your video. Please check the console for more details."
      );
    }
  };

  const cleanupFiles = () => {
    try {
      const ffmpeg = ffmpegRef.current;
      if (ffmpeg.FS && ffmpeg.FS("readdir", "/").includes("input.mp4")) {
        ffmpeg.FS("unlink", "input.mp4");
      }
      if (ffmpeg.FS && ffmpeg.FS("readdir", "/").includes("output.mp4")) {
        ffmpeg.FS("unlink", "output.mp4");
      }
    } catch (error) {
      console.error("Cleanup failed:", error);
    }
  };

  return {
    file,
    setFile,
    interpolate,
    setInterpolate,
    sliderValue,
    setSliderValue,
    loaded,
    setLoaded,
    submitted,
    setSubmitted,
    videoURL,
    setVideoURL,
    loadFFmpeg,
    defineSilenceFrames,
    cleanupFiles,
    messageRef,
    dropFrames,
  };
};
