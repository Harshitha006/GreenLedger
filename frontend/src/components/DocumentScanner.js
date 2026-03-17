import React, { useRef, useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';

const DocumentScanner = ({ onCapture, onClear }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [capturedImage, setCapturedImage] = useState(null);
    const [location, setLocation] = useState(null);
    const [gettingLocation, setGettingLocation] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);

    const startCamera = async () => {
        try {
            let mediaStream;
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }, // Prefer back camera
                    audio: false
                });
            } catch (cameraError) {
                // Fallback for laptops/desktops without an environment camera
                mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false
                });
            }
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            setCameraActive(true);
            getLocation();
        } catch (err) {
            console.error("Error accessing camera:", err);
            toast.error("Could not access camera. Please check permissions.");
        }
    };

    const stopCamera = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setCameraActive(false);
    }, [stream]);

    const getLocation = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser");
            return;
        }

        setGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setLocation({ lat: latitude, lng: longitude });
                setGettingLocation(false);
            },
            (error) => {
                console.error("Error getting location:", error);
                toast.error("Could not get GPS coordinates. Please enable location services.");
                setGettingLocation(false);
            },
            { enableHighAccuracy: true }
        );
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const imageData = canvas.toDataURL('image/jpeg');
            setCapturedImage(imageData);
            
            // Convert dataURL to File object
            fetch(imageData)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
                    onCapture(file, location);
                });
            
            stopCamera();
        }
    };

    const retake = () => {
        setCapturedImage(null);
        onClear();
        startCamera();
    };

    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, [stopCamera]);

    return (
        <div className="space-y-4">
            {!cameraActive && !capturedImage && (
                <button
                    type="button"
                    onClick={startCamera}
                    className="w-full py-4 flex flex-col items-center justify-center border-2 border-dashed border-primary-300 rounded-xl bg-primary-50 hover:bg-primary-100 transition-all group"
                >
                    <div className="w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center text-white mb-2 shadow-lg group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <circle cx="12" cy="13" r="4" />
                        </svg>
                    </div>
                    <span className="font-semibold text-primary-700">Open Camera Scanner</span>
                    <span className="text-xs text-primary-500 mt-1">Capture original proof with Geo-Tag</span>
                </button>
            )}

            {cameraActive && (
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video shadow-2xl ring-4 ring-primary-100">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                    />
                    
                    {/* Overlay UI */}
                    <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
                        <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center text-white text-xs border border-white/20">
                            <div className={`w-2 h-2 rounded-full mr-2 ${gettingLocation ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></div>
                            {gettingLocation ? 'Acquiring GPS...' : location ? `G-TAG: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'GPS OFFLINE'}
                        </div>
                        <button
                            type="button"
                            onClick={stopCamera}
                            className="pointer-events-auto bg-white/20 hover:bg-white/40 text-white rounded-full p-2 backdrop-blur-md transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-8 px-4">
                        <div className="w-12"></div> {/* Spacer */}
                        <button
                            type="button"
                            onClick={capturePhoto}
                            className="w-16 h-16 bg-white border-4 border-primary-500 rounded-full flex items-center justify-center p-1 active:scale-90 transition-transform shadow-xl"
                        >
                            <div className="w-full h-full bg-white rounded-full hover:bg-primary-50 transition-colors"></div>
                        </button>
                        <button
                            type="button"
                            onClick={getLocation}
                            className="bg-black/50 p-3 rounded-full text-white backdrop-blur-md hover:bg-black/70 transition-colors"
                            title="Refresh Location"
                        >
                            <svg className={`w-5 h-5 ${gettingLocation ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                    </div>

                    {/* Scanning Guide Overlay */}
                    <div className="absolute inset-x-8 inset-y-8 border-2 border-white/30 rounded-lg pointer-events-none flex items-center justify-center">
                         <div className="w-full h-[1px] bg-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-scan"></div>
                    </div>
                </div>
            )}

            {capturedImage && (
                <div className="relative rounded-xl overflow-hidden shadow-xl ring-4 ring-green-100">
                    <img src={capturedImage} alt="Captured scan" className="w-full aspect-video object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-4">
                        <div className="flex justify-between items-center">
                            <div className="text-white">
                                <p className="text-sm font-bold flex items-center">
                                    <svg className="w-4 h-4 mr-1 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                    </svg>
                                    GEO-TAGGED
                                </p>
                                <p className="text-[10px] opacity-80">{location?.lat.toFixed(6)}, {location?.lng.toFixed(6)}</p>
                            </div>
                            <button
                                type="button"
                                onClick={retake}
                                className="bg-white/20 hover:bg-white/40 text-white px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md transition-colors border border-white/20"
                            >
                                Retake
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <canvas ref={canvasRef} className="hidden" />
            
            <style jsx>{`
                @keyframes scan {
                    0% { transform: translateY(-100%); opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { transform: translateY(100%); opacity: 0; }
                }
                .animate-scan {
                    animation: scan 3s infinite linear;
                }
            `}</style>
        </div>
    );
};

export default DocumentScanner;
