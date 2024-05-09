import { FFmpeg } from "@ffmpeg/ffmpeg";
import React, { useRef, useState } from "react";
import { useVideoProcessing } from "./useVideoProcessing";

function FileUpload() {
  const DEFAULT_FPS = 30;
  const [file, setFile] = useState(null);
  const [interpolate, setInterpolate] = useState(false);
  const [sliderValue, setSliderValue] = useState(DEFAULT_FPS);
  const [submitted, setSubmitted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const messageRef = useRef(null);
  const videoRef = useRef(null);

  const { loadFFmpeg, transcode, cleanupFiles } = useVideoProcessing();

  const ffmpegRef = useRef(new FFmpeg());

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (
      selectedFile &&
      selectedFile.type.startsWith("video/") &&
      selectedFile.name.endsWith(".mp4")
    ) {
      setFile(selectedFile);
    } else {
      alert("Please upload a video file in MP4 format");
      event.target.value = null;
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
    setSubmitted(true);
    if (!loaded) {
      const isLoaded = await loadFFmpeg(
        { logging: true },
        ffmpegRef.current,
        messageRef
      );
      setLoaded(isLoaded);
    }
    const uploadData = {
      file,
      interpolate,
      fps: interpolate ? sliderValue : null,
    };
    await transcode(uploadData, ffmpegRef.current, videoRef);
    setSubmitted(false);
    cleanupFiles(ffmpegRef.current);
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
      {loaded && videoRef && (
        <a
          href={videoRef}
          download="output.mp4"
          className="btn btn-success mt-4 col-4 d-block mx-auto"
        >
          Download Video
        </a>
      )}
      <p className="lead text-center mt-4" ref={messageRef}></p>
    </div>
  );
}

export default FileUpload;
