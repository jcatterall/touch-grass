# Todo

## AR
We need to investigate an issue where activity recognition is getting stuck at either walking or idle. I had a scenario yesterday where I went into work and activity recognition was recognised as walking. Motion detection stopped the tracking, but it stayed as activity recognition walking for the entire day even when I was sat at my desk idle for over an hour. Can we do a full investigation into the issue and determine some fixes? Try to keep regression to a minimum, but we need to ensure that tracking is correctly recording. Motion detection also seems to be working absolutely fine.

Trace through the entire activity recognition workflow from enabling it initially, stopping it, the exit transitions and start/stop.

This is the ideal behaviour ot ensure that activity recognition is constantly being tracked correctly:
- Activity recognition is only monitored when auto tracking is enabled
- We are constantly monitoring the activity recognition states while auto tracking is enabled, and this is correctly used for determining whether tracking is enabled (along with motion detection)
- On start/stop: when tracking has been auto stopped, then we continue to monitor activity recognition
- Auto tracking has been disabled: then we stop monitoring the activity recognition
- We are updating the Home Screen debug & tracking state with the latest monitored activity recognition state

Do not make any changes to motion detection, it is currently working as intended.

## Day metrics
I recorded a bunch of activity yesterday, 2.5 km of walking and 25 minutes of activity as well. I woke up this morning, and my home screen and my notification are showing the activity from yesterday. I would have imagined that we would only be showing the activity for today, which should be virtually nothing, given that I've just woken up and haven't been outside. Can we do a full audit of the code around displaying our current day's activity? We need to ensure that the home screen and the notification are displaying only the activity for today. 

Do a full audit to ensure that the today's metrics are always today's. 

## Notification
I've also noticed two issues with the notification which we need to investigate:
1. We aren't showing the updated plan details when a plan is disabled: I have a situation where I have two different plan types: When both are enabled, the notification is displayed as showing both the progress for the distance and the time. When I disable the time-based plan and it's no longer active for today, then the notification is still showing the progress for both distance and time-related plans. We need to ensure that the notification only shows progress for active plans for the current day. 
2. We are also displaying the sticky notification that contains the active plan and the progress incorrectly. Currently, we are only showing this notification when auto tracking is enabled; however, we should always show the notification to ensure that the user knows whether they have an active plan for the day.



