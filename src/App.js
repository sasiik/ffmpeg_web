import React, { useState, useEffect, useRef } from 'react';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import './App.css';


function FileUpload() {
  const DEFAULT_FPS = 30;
  const [file, setFile] = useState(null);
  const [interpolate, setInterpolate] = useState(false); // State to handle the checkbox
  const [sliderValue, setSliderValue] = useState(DEFAULT_FPS);
   // State to handle the slider value
  const [loaded, setLoaded] = useState(false);
  const ffmpegRef = useRef(new FFmpeg());
  const videoRef = useRef(null);
  const messageRef = useRef(null);

  // window.onbeforeunload = function() {
  //   if (ffmpegRef.current) {
  //     ffmpegRef.current = null; // Properly unload FFmpeg to free up resources
  //   }
  //   // Perform cleanup tasks here
  //   // e.g., revoke blob URLs, terminate workers, close database connections
  // //   return null;  // Returning null prevents the browser from displaying a confirmation dialog
  // // };
  // window.onbeforeunload = function() {
  //   localStorage.clear();
  //   sessionStorage.clear();
  //   return null;  // Optionally return a string to prompt the user with a confirmation dialog
  // };

  useEffect(() => {
    const loadFFmpeg = async () => {
        const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/umd';
        const ffmpeg = ffmpegRef.current

        ffmpeg.on('progress', ({ progress, time }) => {
          messageRef.current.innerHTML = `${progress * 100} % (transcoded time: ${time / 1000000} s)`;
        });

        ffmpeg.on('log', ({ message }) => {
          messageRef.current.innerHTML = message;
          console.log(message);
        });

        try {
            // Generate blob URLs
            // Load FFmpeg with the generated URLs
              await ffmpeg.load({
                  coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                  wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                  workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
              });

              setLoaded(true);
            // Use FFmpeg for whatever needed here
        } catch (error) {
            console.error('Error loading FFmpeg:', error);
        }
    };

    loadFFmpeg();
}, []);

  

  // Handler for file change event
  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      // Check if the file is a video
      if (selectedFile.type.startsWith('video/')) {
        if (selectedFile.name.endsWith('.webm')) {
          setFile(selectedFile);
        }
        else {
          alert('Video file should be in WEBM format');
        }
        
      } else {
        alert('Please upload a video file');
        setFile(null); // Reset file state if not a video
        event.target.value = null;
      }
    }
  };

  // Handler for checkbox change
  const handleCheckboxChange = (event) => {
    setInterpolate(event.target.checked);
     // Update the state based on checkbox
  };

  // Handler for slider change
  const handleSliderChange = (event) => {
    setSliderValue(event.target.value); // Update the slider value
  };

  // Handler for submit button
  const handleSubmit = () => {
    if (!file) {
      alert('Please upload a file first.');
      return;
    }
  
    // Construct a data object
    const uploadData = {
      file: file,
      interpolate: interpolate,
      fps: interpolate ? sliderValue : null // Conditionally add FPS only if interpolate is true
    };
  
    // Pass the data object to the processing function
    transcode(uploadData);
  
    // Log submission details for verification
    console.log('Submitted');
  };

  const transcode = async({ file, interpolate, fps }) => {
    let video_filter;
    const ffmpeg = ffmpegRef.current;

    if (interpolate && fps !== null) {
      video_filter = `mpdecimate,setpts=N/FRAME_RATE/TB,minterpolate='mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=${fps}`
    } else {
      video_filter = `mpdecimate,setpts=N/FRAME_RATE/TB`
      console.log("Interpolation not selected, ignoring FPS.");
    }
    await ffmpeg.writeFile('input.webm', await fetchFile(file));
    await ffmpeg.exec(['-i', 'input.webm', 'output.webm']);
    const data = await ffmpeg.readFile('output.webm');
    videoRef.current.src =
        URL.createObjectURL(new Blob([data.buffer], {type: 'video/webm'}));
    }

  return (
    <div className="container mt-5">
      <div className={loaded ? "overlay-content" : "overlay"}>
      {loaded ? (
          <>
          </>
        ) : (
          <div className="col text-center">
            <p>Loading FFmpeg</p>
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        )}
      </div>

      <h1 className="mb-4 text-center">Upload a File</h1>
      <p className="lead mb-3">Select a video file</p>
      <input type="file" className="form-control mb-3" onChange={handleFileChange} />
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
      <button type="button" className="btn btn-primary mt-4 col-4 d-block mx-auto" onClick={handleSubmit}>
        Submit
      </button>
      {loaded && (
        <>
        <video ref={videoRef} controls></video><br/>
        <p ref={messageRef}></p>
        </>
      )}
    </div>
  );

}

export default FileUpload;
