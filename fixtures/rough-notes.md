Notes after migrating the dashboard to server components

The migration took 11 days instead of the 3 I estimated, mostly because of data fetching I did not know existed.

We removed 4 client side fetch hooks and the page got faster without a single memo.

Lesson: estimate the migration by counting data sources, not components.
