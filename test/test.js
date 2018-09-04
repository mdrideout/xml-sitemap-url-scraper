var expect = require('chai').expect;
var addTwoNumbers = require('../addTwoNumbers');

describe('addTwoNumbers()', () => {
  it('should add two numbers', () => {
    
    // 1. ARRANGE
    var x = 5;
    var y = 1;
    var sum1 = x + y;

    // 2. ACT
    addTwoNumbers(x, y, "this is a test message")
    .then((response) => {
        // 3. Expect
        expect(response).to.equal(sum1);
    })
    .catch((error) => {
        // 3. Expect
        expect(error).to.equal(sum1);
    })

  });
});