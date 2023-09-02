const CONFIDENCE_THRESHOLD = 0.6;
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 360;

const UPDATE_INTERVAL = 30;  // Update feedback every 30 frames, adjust as needed
const INACTIVITY_LIMIT = 60;  // 2 seconds at 30fps
const ACTIVITY_THRESHOLD = 10;  // This is just an example value, you may need to adjust it based on your needs.
const THRESHOLD = 30;  // Threshold of 10 degrees difference for max accuracy

let capture;  // Live video
let preRecordedVideo; // Pre-recorded video
let posenetLive, posenetPreRecorded; // Separate PoseNet models for live and pre-recorded videos
let singlePoseLive, singlePosePreRecorded; // Poses for live and pre-recorded videos
let skeletonLive, skeletonPreRecorded;
let frameCounter = 0;
let inactiveFrames = 0;
let feedbackMessage = "Waiting for pose detection..."; 

let startButton;

let activityStarted = false;


function setup() {
    createCanvas(VIDEO_WIDTH * 2, VIDEO_HEIGHT); // Double the width for side-by-side videos
    setupCapture();
    setupPreRecordedVideo();
    setupPoseNet();

    startButton = createButton('Start');
    startButton.position(VIDEO_WIDTH, VIDEO_HEIGHT + 20);
    startButton.mousePressed(startActivity);
}


function startActivity() {
    activityStarted = true;
    startButton.hide();
}


function setupCapture() {
    capture = createCapture(VIDEO);
    capture.size(VIDEO_WIDTH, VIDEO_HEIGHT);
    capture.hide();
}

function setupPreRecordedVideo() {
    preRecordedVideo = createVideo(['ref_3.mp4']);
    preRecordedVideo.loop();
    preRecordedVideo.hide();
    preRecordedVideo.speed(0.5); 

    // Wait for the video to load before initializing PoseNet
    preRecordedVideo.elt.onloadeddata = () => {
        videoLoadCallback();
        // Now that the video data has loaded, we can safely set up PoseNet
        if (!posenetPreRecorded) {
            posenetPreRecorded = ml5.poseNet(preRecordedVideo, () => console.log('Pre-recorded PoseNet Model Loaded'));
            posenetPreRecorded.on('pose', receivedPosesPreRecorded);
        }
    };
}


function receivedPosesLive(poses) {
    console.log("Live Poses Detected:", poses);
    if (poses.length > 0) {
        singlePoseLive = poses[0].pose;
        skeletonLive = poses[0].skeleton;
    }
}


function receivedPosesPreRecorded(poses) {
    console.log("Pre-recorded Poses Detected:", poses);

    if (poses.length > 0) {
        singlePosePreRecorded = poses[0].pose;
        skeletonPreRecorded = poses[0].skeleton;
    }
}

function videoLoadCallback() {
    let videoAspectRatio = preRecordedVideo.width / preRecordedVideo.height;
    preRecordedVideo.size(VIDEO_HEIGHT * videoAspectRatio, VIDEO_HEIGHT);
}

function setupPoseNet() {
    posenetLive = ml5.poseNet(capture, () => console.log('Live PoseNet Model Loaded'));
    posenetLive.on('pose', receivedPosesLive);

    posenetPreRecorded = ml5.poseNet(preRecordedVideo, () => console.log('Pre-recorded PoseNet Model Loaded'));
    posenetPreRecorded.on('pose', receivedPosesPreRecorded);
}




function calculateAngle(A, B, C) {
    const a = dist(B.x, B.y, C.x, C.y);
    const b = dist(A.x, A.y, C.x, C.y);
    const c = dist(A.x, A.y, B.x, B.y);
    const angleRad = Math.acos((a*a + b*b - c*c) / (2*a*b));
    const angleDeg = angleRad * (180 / Math.PI);
    return angleDeg;
}

function drawKeypoints(pose, xOffset) {
    fill(255, 0, 0);
    const dotSize = 10;  
    for (let i = 0; i < pose.keypoints.length; i++) {
        const keypoint = pose.keypoints[i];
        if (keypoint.score > CONFIDENCE_THRESHOLD) {
            ellipse(keypoint.position.x + xOffset, keypoint.position.y, dotSize);
        }
    }
}

function drawSkeleton(skeleton, xOffset) {
    stroke(255, 255, 255);
    strokeWeight(5);
    for (let j = 0; j < skeleton.length; j++) {
        const startPoint = skeleton[j][0];
        const endPoint = skeleton[j][1];
        if (startPoint.score > CONFIDENCE_THRESHOLD && endPoint.score > CONFIDENCE_THRESHOLD) {
            line(startPoint.position.x + xOffset, startPoint.position.y, endPoint.position.x + xOffset, endPoint.position.y);
        }
    }
}


function drawPoses(pose, skeleton, xOffset = 0) {
    if (pose) {
        drawKeypoints(pose, xOffset);
        drawSkeleton(skeleton, xOffset);

        const angles = getJointAngles(pose);

        // Set text properties
        fill(0, 0, 255); // Blue color
        textSize(16);
        stroke(255); // White stroke
        strokeWeight(0); // Adjust the stroke weight as needed

        // Display angles at joint positions
        text(`${angles.rightElbow.toFixed(2)}°`, pose.keypoints[8].position.x + xOffset, pose.keypoints[8].position.y);
        text(`${angles.leftElbow.toFixed(2)}°`, pose.keypoints[7].position.x + xOffset, pose.keypoints[7].position.y);
        text(`${angles.rightShoulder.toFixed(2)}°`, pose.keypoints[6].position.x + xOffset, pose.keypoints[6].position.y);
        text(`${angles.leftShoulder.toFixed(2)}°`, pose.keypoints[5].position.x + xOffset, pose.keypoints[5].position.y);
        text(`${angles.rightKnee.toFixed(2)}°`, pose.keypoints[14].position.x + xOffset, pose.keypoints[14].position.y);
        text(`${angles.leftKnee.toFixed(2)}°`, pose.keypoints[13].position.x + xOffset, pose.keypoints[13].position.y);
    }
}

function getJointAngles(pose) {
    const keypoints = pose.keypoints;
    return {
        rightElbow: calculateAngle(keypoints[6].position, keypoints[8].position, keypoints[10].position),
        leftElbow: calculateAngle(keypoints[5].position, keypoints[7].position, keypoints[9].position),
        rightShoulder: calculateAngle(keypoints[12].position, keypoints[6].position, keypoints[8].position),
        leftShoulder: calculateAngle(keypoints[11].position, keypoints[5].position, keypoints[7].position),
        rightKnee: calculateAngle(keypoints[12].position, keypoints[14].position, keypoints[16].position),
        leftKnee: calculateAngle(keypoints[11].position, keypoints[13].position, keypoints[15].position)
    };
}

function getJointAnglesDifference(pose1, pose2) {
    const angles1 = getJointAngles(pose1);
    const angles2 = getJointAngles(pose2);

    return {
        rightElbow: Math.abs(angles1.rightElbow - angles2.rightElbow),
        leftElbow: Math.abs(angles1.leftElbow - angles2.leftElbow),
        rightShoulder: Math.abs(angles1.rightShoulder - angles2.rightShoulder),
        leftShoulder: Math.abs(angles1.leftShoulder - angles2.leftShoulder),
        rightKnee: Math.abs(angles1.rightKnee - angles2.rightKnee),
        leftKnee: Math.abs(angles1.leftKnee - angles2.leftKnee)
    };
}



function isUserInactive(differences) {
    let totalDifference = 0;
    for (let joint in differences) {
        totalDifference += differences[joint];
    }
    return totalDifference < ACTIVITY_THRESHOLD;
}

function getAccuracyPercentage(deviation, threshold) {
    let accuracy = (1 - (deviation / threshold)) * 100;
    return Math.max(accuracy, 0);  // If the deviation exceeds the threshold, set accuracy to 0%
}


function updateFeedback() {
    if (singlePoseLive && singlePosePreRecorded) {
        const differences = getJointAnglesDifference(singlePoseLive, singlePosePreRecorded);

        if (isUserInactive(differences)) {
            inactiveFrames++;
            if (inactiveFrames >= INACTIVITY_LIMIT) {
                feedbackMessage = "Please follow the activity as shown in the video!";
                return;  // If the user is inactive, we don't need to compute other feedbacks
            }
        } else {
            inactiveFrames = 0;  // Reset inactivity counter if there's activity
        }

        let maxDifferenceJoint = null;
        let maxDifferenceValue = 0;
        for (let joint in differences) {
            if (differences[joint] > maxDifferenceValue) {
                maxDifferenceJoint = joint;
                maxDifferenceValue = differences[joint];
            }
        }

        let accuracy = getAccuracyPercentage(maxDifferenceValue, THRESHOLD);
        
        // Check if accuracy is below threshold and prompt user
        if (accuracy < 50) {
            feedbackMessage = "Please follow the activity as shown in the video!";
        } else if (maxDifferenceValue > THRESHOLD) {
            feedbackMessage = `Adjust ${maxDifferenceJoint}. You are ${accuracy.toFixed(2)}% accurate.`;
        } else {
            feedbackMessage = "Well Done!";
        }
    }
}


function drawFeedback() {
    if (feedbackMessage === "Well Done!") {
        fill(0, 255, 0); // Red color
    } else {
        fill(255, 0, 0); // Yellow color
    }
    textSize(20);
    text(feedbackMessage, 10, VIDEO_HEIGHT - 30);
}




function draw() {
    // Check if the activity has started
    if (!activityStarted) {
        fill(255, 0, 0); // Red color
        textSize(20);
        text("Press 'Start' when you're ready!", 10, VIDEO_HEIGHT - 10);
        return;  // Exit the draw loop early if the activity hasn't started
    }

    image(capture, 0, 0);  // Live video on the left

    let xOffset = VIDEO_WIDTH; // Starting position for pre-recorded video on the right
    image(preRecordedVideo, xOffset, 0);  
    
    drawPoses(singlePoseLive, skeletonLive);
    drawPoses(singlePosePreRecorded, skeletonPreRecorded, xOffset); 

    frameCounter++;

    if (frameCounter >= UPDATE_INTERVAL) {
        updateFeedback();
        frameCounter = 0;
    }

    drawFeedback();
}













