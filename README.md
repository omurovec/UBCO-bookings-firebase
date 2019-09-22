# UBCO-bookings-firebase

Firebase functions for the UBCO Studyroom Booking App

## Testing
Install dependancies

```bash
cd functions
npm install
```

Sign into the Firebase console and create a new project.

Use the firebase cli to login and link the project you made

```bash
firebase login
//login with your firebase credentials
firebase use MY_PROJECT
```

#### You're all setup now!

note: The firebase spark plan does not allow for outgoing
requests which this project relies on however you can still
test the project locally by following these steps

```bash
firebase deploy --only functions
firebase emulators:start --only functions
```

## Contributing
Pull requests are welcome and encouraged. For major changes please open an issue first to discuss your ideas.

## License

[MIT](https://choosealicense.com/licenses/mit/)
