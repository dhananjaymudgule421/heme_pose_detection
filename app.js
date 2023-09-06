let net;
let webcamElement = document.getElementById('webcam');
let prerecordedElement = document.getElementById('prerecorded');

let canvasWebcam = document.getElementById('canvas-webcam');
let canvasPrerecorded = document.getElementById('canvas-prerecorded');

let ctxWebcam = canvasWebcam.getContext('2d');
let ctxPrerecorded = canvasPrerecorded.getContext('2d');

const KEYPOINT_RADIUS = 5;
const SKELETON_COLOR = '#FFFFFF';

let feedbackCounter = 0;
const FEEDBACK_FRAME_THRESHOLD = 15;

let FEEDBACK_THRESHOLD = 1000; // Initialize with a default value

prerecordedElement.playbackRate = 0.5;

function updateFeedbackThreshold() {
    let thresholdValue = document.getElementById('feedbackThreshold').value;
    if (thresholdValue) {
        FEEDBACK_THRESHOLD = parseInt(thresholdValue);
    }
}







// async function setupCamera() {
//     webcamElement.width = 640;
//     webcamElement.height = 480;

//     const stream = await navigator.mediaDevices.getUserMedia({ 'video': true });
//     webcamElement.srcObject = stream;
    
//     return new Promise((resolve) => {
//         webcamElement.onloadedmetadata = () => {
//             resolve(webcamElement);
//         };
//     });
// }


async function setupCamera() {
    webcamElement.width = 640;
    webcamElement.height = 480;

    const stream = await navigator.mediaDevices.getUserMedia({ 'video': true });
    webcamElement.srcObject = stream;

    // Add the flipped class to webcamElement to mirror the video feed
    webcamElement.classList.add('flipped');
    
    return new Promise((resolve) => {
        webcamElement.onloadedmetadata = () => {
            resolve(webcamElement);
        };
    });
}




async function loadPoseNet() {
    net = await posenet.load();
}

// function drawKeypoints(keypoints, ctx) {
//     ctx.fillStyle = SKELETON_COLOR;
//     for (let i = 0; i < keypoints.length; i++) {
//         const keypoint = keypoints[i];
//         if (keypoint.score > 0.5) {
//             ctx.beginPath();
//             ctx.arc(keypoint.position.x, keypoint.position.y, KEYPOINT_RADIUS, 0, 2 * Math.PI);
//             ctx.fill();
//         }
//     }
// }

function drawKeypoints(keypoints, ctx, isFlipped = false) {
    ctx.fillStyle = SKELETON_COLOR;
    for (let i = 0; i < keypoints.length; i++) {
        const keypoint = keypoints[i];
        let x = keypoint.position.x;
        if (isFlipped) {
            x = ctx.canvas.width - keypoint.position.x;
        }
        if (keypoint.score > 0.5) {
            ctx.beginPath();
            ctx.arc(x, keypoint.position.y, KEYPOINT_RADIUS, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
}



// function drawSkeleton(keypoints, ctx) {
//     const adjacentKeyPoints = posenet.getAdjacentKeyPoints(keypoints, 0.5);

//     ctx.strokeStyle = SKELETON_COLOR;
//     ctx.lineWidth = 2;

//     adjacentKeyPoints.forEach((keypoints) => {
//         ctx.beginPath();
//         ctx.moveTo(keypoints[0].position.x, keypoints[0].position.y);
//         ctx.lineTo(keypoints[1].position.x, keypoints[1].position.y);
//         ctx.stroke();
//     });
// }


function drawSkeleton(keypoints, ctx, isFlipped = false) {
    const adjacentKeyPoints = posenet.getAdjacentKeyPoints(keypoints, 0.5);

    ctx.strokeStyle = SKELETON_COLOR;
    ctx.lineWidth = 2;

    adjacentKeyPoints.forEach((keypoints) => {
        let startX = keypoints[0].position.x;
        let endX = keypoints[1].position.x;

        if (isFlipped) {
            startX = ctx.canvas.width - keypoints[0].position.x;
            endX = ctx.canvas.width - keypoints[1].position.x;
        }

        ctx.beginPath();
        ctx.moveTo(startX, keypoints[0].position.y);
        ctx.lineTo(endX, keypoints[1].position.y);
        ctx.stroke();
    });
}






function calculatePoseDifference(pose1, pose2) {
    let totalDifference = 0;
    const faceKeypoints = ["nose", "leftEye", "rightEye", "leftEar", "rightEar"];

    // Calculate center of each pose
    let center1 = { x: 0, y: 0 };
    let center2 = { x: 0, y: 0 };

    for (let i = 0; i < pose1.keypoints.length; i++) {
        center1.x += pose1.keypoints[i].position.x;
        center1.y += pose1.keypoints[i].position.y;
        center2.x += pose2.keypoints[i].position.x;
        center2.y += pose2.keypoints[i].position.y;
    }

    center1.x /= pose1.keypoints.length;
    center1.y /= pose1.keypoints.length;
    center2.x /= pose2.keypoints.length;
    center2.y /= pose2.keypoints.length;

    // Calculate average distance of keypoints from the center to get a sense of scale
    let avgDist1 = 0;
    let avgDist2 = 0;

    for (let i = 0; i < pose1.keypoints.length; i++) {
        avgDist1 += distance(pose1.keypoints[i].position, center1);
        avgDist2 += distance(pose2.keypoints[i].position, center2);
    }

    avgDist1 /= pose1.keypoints.length;
    avgDist2 /= pose2.keypoints.length;

    // Scale factor based on average distance
    const scaleFactor = avgDist2 / avgDist1;

    // Calculate normalized pose difference
    for (let i = 0; i < pose1.keypoints.length; i++) {
        if (faceKeypoints.includes(pose1.keypoints[i].part)) {
            continue;
        }

        const scaledPosition1 = {
            x: center1.x + (pose1.keypoints[i].position.x - center1.x) * scaleFactor,
            y: center1.y + (pose1.keypoints[i].position.y - center1.y) * scaleFactor
        };

        const diff = distance(scaledPosition1, pose2.keypoints[i].position);
        totalDifference += diff;
    }
    
    return totalDifference;
}




let mistakesCounter = {};

let isFeedbackDisplayed = false;

function displayFeedback(poseDifference, mostOffPart = null) {
    const feedbackElement = document.getElementById('feedback');
    const progressBar = document.getElementById('progressBar');
    
    // Define a constant for the maximum expected pose difference
    const MAX_POSE_DIFFERENCE = 3500;  // Adjust this value based on your observations
    
    // Normalize pose difference to a scale of [0, 100]
    let percentageMatch = 100 * (1 - (poseDifference / MAX_POSE_DIFFERENCE));
    if (percentageMatch < 0) {
        percentageMatch = 0;
    } else if (percentageMatch > 100) {
        percentageMatch = 100;
    }
    
    // Update the progress bar width based on the normalized percentage match
    progressBar.style.width = percentageMatch + '%';

    // Logic to delay the feedback text
    if (!isFeedbackDisplayed) {
        isFeedbackDisplayed = true;

        setTimeout(() => {
            // If a specific body part is significantly off, prioritize that feedback
            if (mostOffPart) {
                if (!mistakesCounter[mostOffPart]) {
                    mistakesCounter[mostOffPart] = 0;
                }
                mistakesCounter[mostOffPart]++;
                
                if (mistakesCounter[mostOffPart] > 3) {
                    feedbackElement.innerHTML = `Remember to adjust your ${mostOffPart}!`;
                } else {
                    feedbackElement.innerHTML = `Adjust your ${mostOffPart} to match the video.`;
                }
            } else {
                // Otherwise, provide feedback based on the percentage match
                if (percentageMatch > 80) {
                    feedbackElement.innerHTML = "Great job! Keep it up!";
                } else if (percentageMatch > 50) {
                    feedbackElement.innerHTML = "You're on the right track. Adjust a bit more!";
                } else {
                    feedbackElement.innerHTML = "Please adjust your pose to match the video!";
                }
            }

            // Reset the flag after updating the feedback text
            isFeedbackDisplayed = false;
        }, 1000);  // 500ms delay. Adjust this value if you want a longer or shorter delay.
    }

    // Change the progress bar and feedback text color based on the match percentage
    if (percentageMatch > 80) {
        progressBar.style.backgroundColor = 'green';
        feedbackElement.style.color = 'green';
    } else if (percentageMatch > 60) {
        progressBar.style.backgroundColor = 'yellow';
        feedbackElement.style.color = 'orange';
    } else {
        progressBar.style.backgroundColor = 'red';
        feedbackElement.style.color = 'red';
    }

    // Print the percentage match for debugging purposes
    console.log("Percentage Match:", percentageMatch);
}




function getMostOffPart(userKeypoints, referenceKeypoints) {
    let maxDiff = 0;
    let mostOffPart = null;

    for (let i = 0; i < userKeypoints.length; i++) {
        const userKeypoint = userKeypoints[i];
        const referenceKeypoint = referenceKeypoints[i];

        const diff = distance(userKeypoint.position, referenceKeypoint.position);
        
        if (diff > maxDiff) {
            maxDiff = diff;
            mostOffPart = userKeypoint.part;
        }
    }

    return mostOffPart;
}

function distance(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;

    return Math.sqrt(dx * dx + dy * dy);
}


function clearFeedback() {
    const feedbackElement = document.getElementById('feedback');
    feedbackElement.innerText = '';
    const progressBar = document.getElementById('progressBar');
    progressBar.style.width = '0%'; // Reset progress bar
}



async function detectPose(videoElement, ctx) {
    const pose = await net.estimateSinglePose(videoElement);

    // Determine if the video feed is flipped (assuming webcamElement is the one being flipped)
    const isFlipped = videoElement === webcamElement;

    if (videoElement === webcamElement) {
        const prerecordedPose = await net.estimateSinglePose(prerecordedElement);
        const difference = calculatePoseDifference(pose, prerecordedPose);

        console.log("Pose Difference:", difference);

        if (difference > FEEDBACK_THRESHOLD) {
            feedbackCounter++;
            if (feedbackCounter > FEEDBACK_FRAME_THRESHOLD) {
                const mostOffPart = getMostOffPart(pose.keypoints, prerecordedPose.keypoints);
                displayFeedback(difference, mostOffPart);
            }
        } else {
            feedbackCounter = 0;
            clearFeedback();
        }
    }

    ctx.clearRect(0, 0, videoElement.width, videoElement.height);
    
    // Draw keypoints and skeleton based on if the video feed is flipped
    drawKeypoints(pose.keypoints, ctx, isFlipped);
    drawSkeleton(pose.keypoints, ctx, isFlipped);
}










async function bindPage() {
    await setupCamera();
    webcamElement.play();

    await loadPoseNet();

    setInterval(() => {
        detectPose(webcamElement, ctxWebcam);
        detectPose(prerecordedElement, ctxPrerecorded);
    }, 100);
}



function startDetection() {
    bindPage();
    prerecordedElement.src = videoSelector.value;
    prerecordedElement.playbackRate = 0.5;
    prerecordedElement.play();
}












