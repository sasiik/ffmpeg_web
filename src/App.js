import React, { useState, useRef } from "react";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import "./App.css";

function FileUpload() {
  const DEFAULT_FPS = 30;
  const [file, setFile] = useState(null);
  const [interpolate, setInterpolate] = useState(false);
  const [sliderValue, setSliderValue] = useState(DEFAULT_FPS);

  const [loaded, setLoaded] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const ffmpegRef = useRef(new FFmpeg());
  const [videoURL, setVideoURL] = useState("");
  const messageRef = useRef(null);

  const load = async ({ logging = false } = {}) => {
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    const ffmpeg = ffmpegRef.current;

    try {
      // Attach appropriate event handlers based on logging flag
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

      // Load FFmpeg with the given URLs
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

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      if (selectedFile.type.startsWith("video/")) {
        if (selectedFile.name.endsWith(".mp4")) {
          setFile(selectedFile);
        } else {
          alert("Video file should be in MP4 format");
          event.target.value = null;
        }
      } else {
        alert("Please upload a video file");
        event.target.value = null;
      }
    }
  };

  const handleCheckboxChange = (event) => {
    setInterpolate(event.target.checked);
  };

  const handleSliderChange = (event) => {
    setSliderValue(event.target.value);
  };

  const handleSubmit = async () => {
    if (!file) {
      alert("Please upload a file first.");
      return;
    }

    try {
      setSubmitted(true);
      if (!ffmpegRef.current.loaded) {
        await load({ logging: true });
      }

      const uploadData = {
        file: file,
        interpolate: interpolate,
        fps: interpolate ? sliderValue : null,
      };

      await transcode(uploadData);
    } catch (error) {
      console.error("Error during loading or transcoding:", error);
      alert("Failed to process the video due to an error.");
    } finally {
      setSubmitted(false);
      cleanupFiles();
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

  const transcode = async ({ file, interpolate, fps }) => {
    try {
      let video_filter;
      if (videoURL) {
        setVideoURL("");
      }
      const ffmpeg = ffmpegRef.current;

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
      setVideoURL(url);
    } catch (error) {
      console.error("Error during the transcoding process:", error);
      alert("Failed to process video due to an error.");
    }
  };

  return (
    <div className="container mt-5">
      <h1 className="mb-4 text-center">Upload a File</h1>
      <p className="lead mb-3">Select a video file</p>
      <input
        type="file"
        className="form-control mb-3"
        onChange={handleFileChange}
      />
      <div className="form-check mt-4">
        <input
          className="form-check-input"
          type="checkbox"
          id="interpolateCheckbox"
          checked={interpolate}
          onChange={handleCheckboxChange}
        />
        <label className="form-check-label" htmlFor="interpolateCheckbox">
          Interpolate
        </label>
      </div>
      {interpolate && (
        <div className="mt-3">
          <label htmlFor="slider">FPS: {sliderValue}</label>
          <input
            type="range"
            className="form-range"
            id="slider"
            min="0"
            max="100"
            value={sliderValue}
            onChange={handleSliderChange}
          />
        </div>
      )}
      <button
        type="button"
        className="btn btn-primary mt-4 col-4 d-block mx-auto"
        onClick={handleSubmit}
      >
        Submit
      </button>
      {!loaded && submitted && (
        <div className="text-center mt-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p>Loading FFmpeg, please wait...</p>
        </div>
      )}
      {loaded && videoURL && (
        <>
          <a
            href={videoURL}
            download="output.mp4"
            className="btn btn-success mt-4 col-4 d-block mx-auto"
          >
            Download Video
          </a>
        </>
      )}
      <p className="lead text-center mt-4" ref={messageRef}></p>
    </div>
  );
}

export default FileUpload;
