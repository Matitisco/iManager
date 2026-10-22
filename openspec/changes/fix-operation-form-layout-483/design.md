# Design

Use a scoped operation-form class on the integrated operation form and legacy trade editor. Keep the shared Sheet header/body/footer contract. Give field groups a consistent 16px separation, constrain desktop grid columns with minmax(0, 1fr), and stack rows on phones. Lay scanner labels, input, camera and validation out in normal grid flow, aligning the camera to the input regardless of label/error height. Suggestions stay in flow. Bound the operation date calendar to the scrolling body so it cannot cover fixed actions.

Before implementation, main was served using run-local.sh and both forms were captured at 1440×900 and iPhone 13 (390×664). The generated DM Sans wireframe and all screenshots live outside the repository in /workspace/imanager-local/shots/483-e/. The wireframe guides field spacing and fixed chrome; retain one-column phone rows and existing 540px desktop width.

Validate real React form markup with real CSS in Chromium component layout tests, including empty forms, errors, suggestions and both trade editing paths. Verify live local seeded screens and scanner/calendar/select states without persisting business forms. No build.
