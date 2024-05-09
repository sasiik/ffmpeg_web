import { fetchFile, toBlobURL } from "@ffmpeg/util";

export const useVideoProcessing = () => {
  const loadFFmpeg = async ({ logging = false } = {}, ffmpeg, messageRef) => {
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    var isLoaded = false;

    try {
      if (logging) {
        ffmpeg.on("log", ({ message }) => {
          if (messageRef.current) {
            messageRef.current.innerHTML = message;
          }
          console.log(message);
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

      isLoaded = true;
    } catch (error) {
      console.error("Error loading FFmpeg:", error);
      if (messageRef.current) {
        messageRef.current.innerHTML =
          "Failed to load FFmpeg. Please check the console for more details.";
      }
    }
    return isLoaded;
  };

  const transcode = async ({ file, interpolate, fps }, ffmpeg, videoRef) => {
    let video_filter;
    if (videoRef) {
      videoRef = "";
    }

    if (interpolate && fps !== null) {
      video_filter = `mpdecimate,setpts=N/FRAME_RATE/TB,minterpolate='mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=${fps}`;
    } else {
      video_filter = `mpdecimate,setpts=N/FRAME_RATE/TB`;
      console.log("Interpolation not selected, ignoring FPS.");
    }

    await ffmpeg.writeFile("input.mp4", await fetchFile(file));
    await ffmpeg.exec([
      "-i",
      "input.mp4",
      "-vf",
      video_filter,
      "-an",
      "output.mp4",
    ]);
    const data = await ffmpeg.readFile("output.mp4");
    const url = URL.createObjectURL(
      new Blob([data.buffer], { type: "video/mp4" })
    );

    videoRef.current.src = url;
  };

  const cleanupFiles = (ffmpeg) => {
    try {
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
    loadFFmpeg,
    transcode,
    cleanupFiles,
  };
};
