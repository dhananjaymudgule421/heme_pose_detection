const CONFIDENCE_THRESHOLD = 0.6;
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 360;

let capture;  // Live video
let preRecordedVideo; // Pre-recorded video
let posenetLive, posenetPreRecorded; // Separate PoseNet models for live and pre-recorded videos
let singlePoseLive, singlePosePreRecorded; // Poses for live and pre-recorded videos
let skeletonLive, skeletonPreRecorded;
let actor_img, specs, smoke;

function setup() {
    createCanvas(VIDEO_WIDTH * 2, VIDEO_HEIGHT); // Double the width for side-by-side videos
    setupCapture();
    setupPreRecordedVideo();
    setupPoseNet();
    
}

function setupCapture() {
    capture = createCapture(VIDEO);
    capture.size(VIDEO_WIDTH, VIDEO_HEIGHT);
    capture.hide();
}

function setupPreRecordedVideo() {
    preRecordedVideo = createVideo(['ref_4.mp4']);
    preRecordedVideo.loop();
    preRecordedVideo.hide();

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

function receivedPosesLive(poses) {
    if (poses.length > 0) {
        singlePoseLive = poses[0].pose;
        skeletonLive = poses[0].skeleton;
    }
}

function receivedPosesPreRecorded(poses) {
    if (poses.length > 0) {
        singlePosePreRecorded = poses[0].pose;
        skeletonPreRecorded = poses[0].skeleton;
    }
}

function calculateAngle(A, B, C) {
    const a = dist(B.x, B.y, C.x, C.y);
    const b = dist(A.x, A.y, C.x, C.y);
    const c = dist(A.x, A.y, B.x, B.y);
    const angleRad = Math.acos((a*a + b*b - c*c) / (2*a*b));
    const angleDeg = angleRad * (180 / Math.PI);
    return angleDeg;
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
        strokeWeight(3); // Adjust the stroke weight as needed

        // Display angles at joint positions
        text(`${angles.rightElbow.toFixed(2)}°`, pose.keypoints[8].position.x + xOffset, pose.keypoints[8].position.y);
        text(`${angles.leftElbow.toFixed(2)}°`, pose.keypoints[7].position.x + xOffset, pose.keypoints[7].position.y);
        text(`${angles.rightShoulder.toFixed(2)}°`, pose.keypoints[6].position.x + xOffset, pose.keypoints[6].position.y);
        text(`${angles.leftShoulder.toFixed(2)}°`, pose.keypoints[5].position.x + xOffset, pose.keypoints[5].position.y);
        text(`${angles.rightKnee.toFixed(2)}°`, pose.keypoints[14].position.x + xOffset, pose.keypoints[14].position.y);
        text(`${angles.leftKnee.toFixed(2)}°`, pose.keypoints[13].position.x + xOffset, pose.keypoints[13].position.y);
    }
}



//... [Your code remains unchanged up to the getJointAngles function]

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

function provideFeedback(differences) {
    let feedbackMessage = '';
    const threshold = 10;  // Set a threshold for angle difference

    for (let joint in differences) {
        if (differences[joint] > threshold) {
            feedbackMessage += `${joint} difference is too large (${differences[joint].toFixed(2)}°).\n`;
        }
    }

    if (feedbackMessage) {
        fill(255, 0, 0);  // Red color for feedback text
        textSize(16);
        text(feedbackMessage, 10, 20);  // Adjust position as necessary
    }
}

function draw() {
    image(capture, 0, 0);  // Live video on the left

    let xOffset = VIDEO_WIDTH; // Starting position for pre-recorded video on the right
    image(preRecordedVideo, xOffset, 0);  
    
    drawPoses(singlePoseLive, skeletonLive);
    drawPoses(singlePosePreRecorded, skeletonPreRecorded, xOffset); 

    if (singlePoseLive && singlePosePreRecorded) {
        const differences = getJointAnglesDifference(singlePoseLive, singlePosePreRecorded);
        provideFeedback(differences);
    }
}



// function draw() {
//     image(capture, 0, 0);  // Live video on the left

//     let xOffset = VIDEO_WIDTH; // Starting position for pre-recorded video on the right
//     image(preRecordedVideo, xOffset, 0);  
    
//     drawPoses(singlePoseLive, skeletonLive);
//     drawPoses(singlePosePreRecorded, skeletonPreRecorded, xOffset); 
// }

