# GreenConnect A1.3

## Overview

This folder contains my A1.3 Basic Application Development (Version 2). It extends my previous A1.2 application. The application helps people find environmental events in Melbourne and register for an event.

## Features

- Responsive layout for mobile, tablet and desktop screens
- Main navigation with clear website sections
- Event information loaded from a JSON file
- Event search, category and family-friendly filters
- Event selection and registration form
- Form validation with clear error messages
- Searchable and sortable registration records displayed in a data table
- Registration records saved in Local Storage
- Multiple users can create an account, log in and log out
- Passwords are stored as salted hashes instead of plain text
- The current login is saved in Local Storage
- New accounts use the community member role
- A separate admin role can open the protected Registration Records page
- Vue Router guards prevent unauthorised users from opening admin records
- Logged-in users can give each activity a rating from 1 to 5
- Each activity displays the average score and rating count from all users
- A user can update their existing rating without creating a second vote
- Text fields have client-side validation and length limits
- Names containing the HTML characters `<` or `>` are rejected

## Demo Accounts

- Admin: `admin@greenconnect.org` / `Admin123!`
- Community members can create their own accounts from the Account section

## Basic Security

I use Vue text interpolation to display names and registration details. I do not use `v-html`, so Vue displays user input as text instead of running it as HTML. I also validate names, email addresses, passwords and participant numbers before saving the data. Names containing `<` or `>` are rejected because these characters can be used in HTML tags. Passwords are stored as salted hashes instead of plain text.

## Project Setup

```sh
npm install
```

## Run the Application

```sh
npm run dev
```

## Build the Application

```sh
npm run build
```

## Check the Code

```sh
npm run lint
```
