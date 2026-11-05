// goto name   jumps to a labelled if/while and never comes back
// gotor name  jumps there, runs that statement, then returns
// a label is written after the header:  if(...) \name { }   while(...) |name { }
if(true) \greeting {
    print("Hello!".);
}

print("first".);
gotor greeting;
print("second".);
gotor greeting;

goto theend;
print("this line is skipped".);

if(true) \theend {
    print("jumped here".);
}
