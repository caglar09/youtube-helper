npm install -g ios-deploy

unzip YourApp.ipa -d YourApp

ios-deploy --bundle YoutubeHelper/Payload/youtubehelper.app

ios-deploy --bundle YourApp/Payload/YourApp.app --justlaunch # directly launch the app