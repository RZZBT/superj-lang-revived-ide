// a+b a-b a/b (returns int) a%b a^(b) |a|   -- plus the comparisons and && ||
int a : 17;
int b : 5;
print("a + b =",,a + b.);
print("a - b =",,a - b.);
print("a * b =",,a * b.);
print("a / b =",,a / b,,"(whole division)".);
print("a % b =",,a % b.);
print("a ^(2) =",,a ^(2).);
print("|b - a| =",,|b - a|.);
print("a > b && b != 0 :",,a > b && b != 0.);

// math functions: rat() getUp() getDown() sqrt() round() trunc()
rat r : rat(0.75);
print("rat(0.75) =",,r,,"up",,getUp(r),,"down",,getDown(r).);
print("sqrt(81) =",,sqrt(81).);
print("round(2.5) =",,round(2.5),,"trunc(-2.9) =",,trunc(-2.9).);
